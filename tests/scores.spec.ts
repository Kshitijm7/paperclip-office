import { describe, expect, it } from "vitest";
import { computeScores, outputPoints, scoreAgents } from "../src/shared/scores.js";
import { buildPaCheck, buildPaChecks, summarizePaChecks, formatPaReport } from "../src/worker/pa.js";
import type { IssueRow, OfficeAgent } from "../src/shared/office.js";
import type { CostEventRow } from "../src/shared/cost.js";

const now = new Date("2026-09-28T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60_000).toISOString();

function issue(id: string, assignee: string, priority: string, days: number): IssueRow {
  return { id, identifier: id, title: id, status: "done", assigneeAgentId: assignee, parentId: null, updatedAt: ago(days), priority };
}

describe("outputPoints", () => {
  it("weights done issues by priority within the window", () => {
    const issues = [issue("i1", "a", "critical", 1), issue("i2", "a", "low", 1), issue("i3", "a", "high", 20)];
    expect(outputPoints(issues, "a", now.getTime() - 7 * 24 * 60 * 60_000)).toBe(4 + 1); // i3 outside window
  });
});

describe("computeScores", () => {
  it("normalizes productivity against the top performer", () => {
    const scores = computeScores(
      ["a", "b"],
      new Map([["a", 10], ["b", 5]]),
      new Map([["a", 100], ["b", 100]]),
      new Map(),
      { efficiencyStuckPenalty: 0.02 },
    );
    expect(scores.get("a")!.productivity).toBe(100);
    expect(scores.get("b")!.productivity).toBe(50);
  });

  it("gives 0 efficiency to an agent with no output and no spend", () => {
    const scores = computeScores(["a", "b"], new Map([["b", 5]]), new Map([["b", 50]]), new Map(), { efficiencyStuckPenalty: 0.02 });
    expect(scores.get("a")!.efficiency).toBe(0);
  });

  it("penalizes stuck minutes in the efficiency score", () => {
    const withoutStuck = computeScores(["a"], new Map([["a", 10]]), new Map([["a", 100]]), new Map(), { efficiencyStuckPenalty: 0.02 });
    const withStuck = computeScores(["a"], new Map([["a", 10]]), new Map([["a", 100]]), new Map([["a", 60]]), { efficiencyStuckPenalty: 0.02 });
    expect(withStuck.get("a")!.efficiency).toBeLessThanOrEqual(withoutStuck.get("a")!.efficiency);
  });
});

describe("scoreAgents", () => {
  it("falls back to tokens when there is no dollar spend (auto metric)", () => {
    const agents = [{ id: "a", name: "Ada", role: null, title: null, reportsTo: null, status: "active" }];
    const issues = [issue("i1", "a", "medium", 1)];
    const cost: CostEventRow[] = [{ agentId: "a", costCents: 0, tokens: 500, occurredAt: ago(1) }];
    const scores = scoreAgents(agents, issues, cost, new Map(), now, { windowDays: 7, efficiencyStuckPenalty: 0.02, costMetric: "auto" });
    expect(scores.get("a")!.productivity).toBe(100);
    expect(scores.get("a")!.efficiency).toBe(100);
  });
});

function agent(overrides: Partial<OfficeAgent>): OfficeAgent {
  return {
    id: "a", needsApproval: false, name: "Ada", role: null, title: null, reportsTo: null, managerId: null,
    department: "Staff", isChief: false, state: "idle", stuck: false, stuckReason: null, since: null,
    issue: null, runId: null, thought: null, justFinished: false, level: 1, levelName: "Member",
    reportsCount: 0, progress: null, queueDepth: 0, oldestWaitMinutes: null, costCents: 0, costTodayCents: 0,
    tokens: 0, tokensToday: 0, overBudget: false, ...overrides,
  };
}

describe("buildPaCheck", () => {
  it("notes and flags a stuck agent", () => {
    const check = buildPaCheck(agent({ stuck: true, stuckReason: "no output for 40 min" }), now);
    expect(check.flag).toBe("no output for 40 min");
    expect(check.note).toContain("stuck");
  });

  it("flags idle agents with a queue", () => {
    const check = buildPaCheck(agent({ state: "idle", queueDepth: 3 }), now);
    expect(check.flag).toBe("idle with work waiting");
    expect(check.note).toBe("idle with 3 issues waiting");
  });

  it("does not flag a plain idle agent", () => {
    const check = buildPaCheck(agent({ state: "idle" }), now);
    expect(check.flag).toBeNull();
  });

  it("notes a working agent's time on issue", () => {
    const since = new Date(now.getTime() - 42 * 60_000).toISOString();
    const check = buildPaCheck(agent({ state: "working", since, issue: { id: "i1", label: "NWR-101", title: "x", status: "in_progress" } }), now);
    expect(check.note).toBe("working on NWR-101 for 42m");
  });

  it("checks idle agents too, not just active ones", () => {
    const checks = buildPaChecks([agent({ id: "a", state: "idle" }), agent({ id: "b", state: "working" })], now);
    expect(checks.map((c) => c.agentId)).toEqual(["a", "b"]);
  });
});

describe("summarizePaChecks / formatPaReport", () => {
  it("puts flagged agents first and reports top/bottom productivity", () => {
    const a = agent({ id: "a", name: "Ada", stuck: true, stuckReason: "stuck: x", scores: { productivity: 80, efficiency: 50, flag: null, lastCheckedAt: null } });
    const b = agent({ id: "b", name: "Bo", scores: { productivity: 20, efficiency: 90, flag: null, lastCheckedAt: null } });
    const checks = buildPaChecks([a, b], now);
    const summary = summarizePaChecks(checks, [a, b]);
    expect(summary.flagged.map((c) => c.agentId)).toEqual(["a"]);
    expect(summary.topProductivity?.id).toBe("a");
    expect(summary.bottomProductivity?.id).toBe("b");
    const report = formatPaReport(summary, new Map([["a", a], ["b", b]]));
    expect(report).toContain("Flagged: Ada");
    expect(report).toContain("Top productivity: Ada");
  });
});

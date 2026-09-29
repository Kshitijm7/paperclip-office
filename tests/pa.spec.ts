import { describe, expect, it } from "vitest";
import { buildPaChecks, formatPaReport, summarizePaChecks, type PaFlagState } from "../src/worker/pa.js";
import type { OfficeAgent } from "../src/shared/office.js";

const NOW = new Date("2026-09-29T12:00:00Z");

function agent(overrides: Partial<OfficeAgent>): OfficeAgent {
  return {
    id: "a", needsApproval: false, name: "Ada", role: "engineer", title: null, reportsTo: null, managerId: null,
    department: "Eng", isChief: false, state: "idle", stuck: false, stuckReason: null, since: null, issue: null,
    runId: null, thought: null, justFinished: false, level: 1, levelName: "Member", reportsCount: 0, progress: null,
    queueDepth: 0, oldestWaitMinutes: null, costCents: 0, costTodayCents: 0, overBudget: false, tokens: 0, tokensToday: 0,
    ...overrides,
  };
}

const issue = { id: "i1", label: "ISS-1", title: "t", status: "in_progress" };
const team = [
  agent({ id: "chief", name: "Chief", isChief: true }),
  agent({ id: "a", name: "Ada", state: "working", stuck: true, stuckReason: "no output", since: "2026-09-29T11:15:00Z", issue }),
  agent({ id: "b", name: "Bo", state: "idle" }),
  agent({ id: "c", name: "Cy", state: "working", since: "2026-09-29T11:50:00Z", issue: { ...issue, id: "i2", label: "ISS-2" } }),
];

describe("PA supervisor", () => {
  it("counts flag streaks across rounds and marks new vs resolved", () => {
    const prior = new Map<string, PaFlagState>([["a", { flag: "stuck", lastCheckedAt: null, streak: 2 }], ["c", { flag: "stuck", lastCheckedAt: null, streak: 1 }]]);
    const checks = buildPaChecks(team, NOW, prior);
    expect(checks.find((c) => c.agentId === "a")!.streak).toBe(3);
    const s = summarizePaChecks(checks, team, prior);
    expect(s.escalated.map((c) => c.agentId)).toEqual(["a"]);
    expect(s.resolved).toEqual(["c"]);
    expect(s.roll).toHaveLength(4);
  });

  it("suggests reassigning a repeatedly stuck agent's issue to an idle peer", () => {
    const prior = new Map<string, PaFlagState>([["a", { flag: "stuck", lastCheckedAt: null, streak: 1 }]]);
    const s = summarizePaChecks(buildPaChecks(team, NOW, prior), team, prior);
    expect(s.decisions[0].text).toContain("Reassign ISS-1 from Ada to Bo");
  });

  it("puts decisions, roll call and agent reports in the comment", () => {
    const checks = buildPaChecks(team, NOW);
    const s = summarizePaChecks(checks, team, new Map(), [{ agentId: "c", issueLabel: "ISS-2", body: "Finished the parser, tests green.", at: NOW.toISOString() }]);
    const text = formatPaReport(s, new Map(team.map((a) => [a.id, a])), 4);
    expect(text).toContain("## PA round 4");
    expect(text).toContain("### Decisions for the Chief");
    expect(text).toContain("- Cy: working on ISS-2 for 10m");
    expect(text).toContain("- Cy on ISS-2: Finished the parser, tests green.");
  });
});

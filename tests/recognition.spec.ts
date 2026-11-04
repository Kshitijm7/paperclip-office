import { describe, expect, it } from "vitest";
import { computeRecognition, type RunEvent } from "../src/worker/recognition.js";
import type { AgentRow, IssueRow } from "../src/shared/office.js";

const now = new Date("2026-09-28T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60_000).toISOString();

const agents: AgentRow[] = [
  { id: "c", name: "Chief", role: "ceo", title: "Chief", reportsTo: null, status: "active" },
  { id: "a", name: "Ada", role: "engineer", title: null, reportsTo: "c", status: "active" },
  { id: "b", name: "Bo", role: "engineer", title: null, reportsTo: "c", status: "active" },
];

function issue(id: string, assignee: string, days: number): IssueRow {
  return { id, identifier: id, title: id, status: "done", assigneeAgentId: assignee, parentId: null, updatedAt: ago(days) };
}

describe("computeRecognition", () => {
  it("scores closed issues and run outcomes within each window", () => {
    const issues = [issue("i1", "a", 2), issue("i2", "a", 2), issue("i3", "b", 20)];
    const runs: RunEvent[] = [
      { agentId: "a", status: "succeeded", createdAt: ago(1) },
      { agentId: "a", status: "failed", createdAt: ago(1) },
      { agentId: "b", status: "succeeded", createdAt: ago(15) },
    ];
    const rec = computeRecognition(agents, issues, runs, now);
    expect(rec.employeeOfWeek?.agentId).toBe("a"); // closed*3=6 +1 -1 = 6, within 7 days
    expect(rec.employeeOfMonth?.agentId).toBe("a"); // 6 vs b's 3
    expect(rec.leaderboard[0].agentId).toBe("a");
  });

  it("requires a minimum run count for most-reliable", () => {
    const runs: RunEvent[] = [
      { agentId: "a", status: "succeeded", createdAt: ago(1) },
      { agentId: "a", status: "succeeded", createdAt: ago(1) },
    ];
    const rec = computeRecognition(agents, [], runs, now);
    expect(rec.mostReliable).toBeNull();
  });

  it("picks the highest success rate once the minimum run count is met", () => {
    const runs: RunEvent[] = Array.from({ length: 5 }, () => ({ agentId: "a", status: "succeeded", createdAt: ago(1) } as RunEvent));
    const rec = computeRecognition(agents, [], runs, now);
    expect(rec.mostReliable?.agentId).toBe("a");
    expect(rec.mostReliable?.successRate).toBe(1);
  });

  it("returns one winner per department", () => {
    const issues = [issue("i1", "a", 2), issue("i2", "b", 2)];
    const rec = computeRecognition(agents, issues, [], now);
    expect(rec.byDepartment.length).toBeGreaterThan(0);
  });
});

describe("computeRecognition handoffsSent", () => {
  const sent = (from: string, days: number) => ({ from, at: ago(days) });
  const byAgent = (stats: { agentId: string; handoffsSent: number }[]) => Object.fromEntries(stats.map((s) => [s.agentId, s.handoffsSent]));

  it("counts the handoffs each agent sent within the week and the month", () => {
    const issues = [issue("i1", "a", 1)]; // makes Ada the employee of the week and month
    const handoffs = [sent("a", 1), sent("a", 10), sent("b", 20), sent("b", 40), sent("nobody", 1)];
    const rec = computeRecognition(agents, issues, [], now, handoffs);
    expect(rec.employeeOfWeek).toMatchObject({ agentId: "a", handoffsSent: 1 }); // 10 days ago is outside the week
    expect(byAgent(rec.leaderboard)).toEqual({ a: 2, b: 1, c: 0 }); // 40 days ago is outside the month; unknown senders are ignored
  });

  it("counts only the sender, not the receiver", () => {
    const rec = computeRecognition(agents, [], [], now, [{ from: "a", to: "b", issue: "I-1", at: ago(1) } as never]);
    expect(byAgent(rec.leaderboard)).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("uses the same window edge as runs: exactly 7 days ago is outside the week", () => {
    const rec = computeRecognition(agents, [issue("i1", "a", 1)], [], now, [sent("a", 7), sent("a", 6.99)]);
    expect(rec.employeeOfWeek?.handoffsSent).toBe(1);
  });

  it("changes nothing but handoffsSent: same scores, rankings and winners", () => {
    const issues = [issue("i1", "a", 2), issue("i2", "b", 20)];
    const runs: RunEvent[] = Array.from({ length: 6 }, () => ({ agentId: "b", status: "succeeded", createdAt: ago(3) }));
    const busyB = Array.from({ length: 50 }, () => sent("b", 1));
    const without = computeRecognition(agents, issues, runs, now);
    const withHandoffs = computeRecognition(agents, issues, runs, now, busyB);
    const strip = (r: typeof without) => JSON.parse(JSON.stringify(r, (k, v) => (k === "handoffsSent" ? undefined : v)));
    expect(strip(withHandoffs)).toEqual(strip(without));
    expect(withHandoffs.leaderboard.find((s) => s.agentId === "b")?.handoffsSent).toBe(50);
    expect(without.leaderboard.every((s) => s.handoffsSent === 0)).toBe(true); // no handoffs passed: 0, as before
  });
});

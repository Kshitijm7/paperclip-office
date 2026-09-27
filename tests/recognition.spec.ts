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

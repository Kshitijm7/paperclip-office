import { describe, expect, it } from "vitest";
import { buildOfficeStatus } from "../src/worker/office-status-tool.js";
import type { OfficeAgent } from "../src/shared/office.js";
import type { IssueRow } from "../src/shared/office.js";

function agent(overrides: Partial<OfficeAgent>): OfficeAgent {
  return {
    id: "a",
    needsApproval: false,
    name: "Ada",
    role: "engineer",
    title: null,
    reportsTo: null,
    managerId: null,
    department: "Eng",
    isChief: false,
    state: "idle",
    stuck: false,
    stuckReason: null,
    since: null,
    issue: null,
    runId: null,
    thought: null,
    justFinished: false,
    level: 1,
    levelName: "Member",
    reportsCount: 0,
    progress: null,
    queueDepth: 0,
    oldestWaitMinutes: null,
    costCents: 0,
    costTodayCents: 0,
    overBudget: false,
    tokens: 0,
    tokensToday: 0,
    ...overrides,
  };
}

describe("buildOfficeStatus", () => {
  it("counts agents per state and lists idle agents", () => {
    const agents = [agent({ id: "a", state: "idle" }), agent({ id: "b", state: "working" })];
    const result = buildOfficeStatus(agents, [], {}, 5);
    expect(result.counts.idle).toBe(1);
    expect(result.counts.working).toBe(1);
    expect(result.idle.map((a) => a.id)).toEqual(["a"]);
  });

  it("filters by department and state", () => {
    const agents = [
      agent({ id: "a", department: "Eng", state: "working" }),
      agent({ id: "b", department: "Sales", state: "working" }),
    ];
    const result = buildOfficeStatus(agents, [], { department: "Eng" }, 5);
    expect(result.counts.working).toBe(1);
  });

  it("lists stuck agents with their reason", () => {
    const agents = [agent({ id: "a", stuck: true, stuckReason: "no output for 12 min" })];
    const result = buildOfficeStatus(agents, [], {}, 5);
    expect(result.stuck).toEqual([expect.objectContaining({ id: "a", reason: "no output for 12 min" })]);
  });

  it("flags an agent overloaded once open issues reach the threshold", () => {
    const agents = [agent({ id: "a" })];
    const issues: IssueRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: `i${i}`,
      identifier: null,
      title: "t",
      status: "todo",
      assigneeAgentId: "a",
      parentId: null,
      updatedAt: null,
    }));
    const result = buildOfficeStatus(agents, issues, {}, 5);
    expect(result.overloaded).toEqual([expect.objectContaining({ id: "a", openIssues: 5 })]);
  });

  it("does not flag overload below the threshold", () => {
    const agents = [agent({ id: "a" })];
    const issues: IssueRow[] = Array.from({ length: 4 }, (_, i) => ({
      id: `i${i}`,
      identifier: null,
      title: "t",
      status: "todo",
      assigneeAgentId: "a",
      parentId: null,
      updatedAt: null,
    }));
    const result = buildOfficeStatus(agents, issues, {}, 5);
    expect(result.overloaded).toHaveLength(0);
  });
});

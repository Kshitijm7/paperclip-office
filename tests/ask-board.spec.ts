import { describe, expect, it } from "vitest";
import type { OfficeData } from "../src/shared/office.js";
import { boardTasks } from "../src/ui/scene-bridge.js";

describe("boardTasks", () => {
  it("adds each pending approval as a blocked task with an open question", () => {
    const data = {
      tasks: [{ id: "i1", status: "doing", assignee: "a" }],
      approvals: [{ id: "p1", type: "hire_agent", requestedByAgentId: "b", status: "pending", createdAt: "2026-09-28T00:00:00Z", decidedAt: null }],
    } as unknown as OfficeData;
    expect(boardTasks(data)).toEqual([
      { id: "i1", status: "doing", assignee: "a" },
      { id: "approval-p1", status: "blocked", assignee: "b", humanQA: [{ q: "hire_agent" }] },
    ]);
  });

  it("leaves the board alone when there are no approvals", () => {
    expect(boardTasks({ tasks: [] } as unknown as OfficeData)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { buildActivity, pendingApprovals, type ActivityApprovalRow } from "../src/shared/activity.js";

const now = new Date("2026-09-28T12:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

const agentNames = new Map([["a", "Ada"], ["b", "Bo"]]);
const issueLabels = new Map([["i1", { label: "ENG-1", title: "Fix the bug" }]]);

describe("buildActivity", () => {
  it("reports an issue as created when created_at is in window", () => {
    const events = buildActivity({
      issues: [{ id: "i1", identifier: "ENG-1", title: "Fix the bug", status: "todo", createdAt: ago(1), updatedAt: ago(1) }],
      comments: [],
      runs: [],
      approvals: [],
      agentNames,
      issueLabels,
      since: new Date(ago(24)),
      limit: 100,
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("issue_created");
    expect(events[0].text).toBe("ENG-1 created: Fix the bug");
  });

  it("reports an honest status update, not a fabricated assignment, when only updated_at is in window", () => {
    const events = buildActivity({
      issues: [{ id: "i1", identifier: "ENG-1", title: "Fix the bug", status: "in_review", createdAt: ago(48), updatedAt: ago(1) }],
      comments: [],
      runs: [],
      approvals: [],
      agentNames,
      issueLabels,
      since: new Date(ago(24)),
      limit: 100,
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("issue_status_changed");
    expect(events[0].text).toBe("ENG-1 updated to in_review");
  });

  it("merges runs, comments and approvals newest-first and respects the limit", () => {
    const events = buildActivity({
      issues: [],
      comments: [{ id: "c1", issueId: "i1", authorAgentId: "a", createdAt: ago(2) }],
      runs: [
        { id: "r1", agentId: "a", status: "succeeded", startedAt: ago(5), finishedAt: ago(4) },
        { id: "r2", agentId: "b", status: "failed", startedAt: ago(3), finishedAt: ago(0.5) },
      ],
      approvals: [{ id: "ap1", type: "secret", requestedByAgentId: "b", status: "approved", createdAt: ago(6), decidedAt: ago(1) }],
      agentNames,
      issueLabels,
      since: new Date(ago(24)),
      limit: 3,
    });
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("run_failed");
    expect(events.map((e) => e.type)).not.toContain("issue_created");
  });

  it("excludes events outside the window", () => {
    const events = buildActivity({
      issues: [],
      comments: [{ id: "c1", issueId: "i1", authorAgentId: "a", createdAt: ago(50) }],
      runs: [],
      approvals: [],
      agentNames,
      issueLabels,
      since: new Date(ago(24)),
      limit: 100,
    });
    expect(events).toHaveLength(0);
  });

  it("only reports an approval as decided once it leaves pending", () => {
    const events = buildActivity({
      issues: [],
      comments: [],
      runs: [],
      approvals: [{ id: "ap1", type: "secret", requestedByAgentId: "b", status: "pending", createdAt: ago(30), decidedAt: null }],
      agentNames,
      issueLabels,
      since: new Date(ago(24)),
      limit: 100,
    });
    expect(events).toHaveLength(0);
  });
});

describe("pendingApprovals", () => {
  it("returns only pending approvals, oldest first", () => {
    const rows: ActivityApprovalRow[] = [
      { id: "ap1", type: "secret", requestedByAgentId: "a", status: "approved", createdAt: ago(5), decidedAt: ago(1) },
      { id: "ap2", type: "budget", requestedByAgentId: "b", status: "pending", createdAt: ago(2), decidedAt: null },
      { id: "ap3", type: "budget", requestedByAgentId: "b", status: "pending", createdAt: ago(6), decidedAt: null },
    ];
    const pending = pendingApprovals(rows);
    expect(pending.map((a) => a.id)).toEqual(["ap3", "ap2"]);
  });
});

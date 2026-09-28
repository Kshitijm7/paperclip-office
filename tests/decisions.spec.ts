import { describe, expect, it } from "vitest";
import { buildDecisions, requireUserActor, summarizeApproval, summarizeInteraction } from "../src/shared/decisions.js";

const names = new Map([["a1", { name: "Ada", role: null }], ["a2", { name: "Grace", role: null }]]);

describe("summarizeApproval", () => {
  it("maps a pending approval to a decision item", () => {
    const item = summarizeApproval(
      { id: "ap1", type: "hire_agent", requestedByAgentId: "a1", status: "pending", createdAt: "2026-09-28T00:00:00Z" },
      names,
    );
    expect(item).toMatchObject({
      id: "approval-ap1",
      kind: "approval",
      targetId: "ap1",
      title: "Hire agent",
      requester: "Ada",
      resolvable: true,
      link: "/inbox",
    });
  });

  it("falls back to the raw type when there is no friendly title", () => {
    const item = summarizeApproval(
      { id: "ap2", type: "custom_kind", requestedByAgentId: null, status: "pending", createdAt: "2026-09-28T00:00:00Z" },
      names,
    );
    expect(item.title).toBe("custom_kind");
    expect(item.requester).toBeNull();
  });
});

describe("summarizeInteraction", () => {
  it("marks a request_confirmation card as resolvable and links to the issue", () => {
    const item = summarizeInteraction(
      {
        id: "int1", issueId: "iss1", kind: "request_confirmation", status: "pending",
        title: "Deploy to prod?", summary: "Ship the release", createdByAgentId: "a2", createdAt: "2026-09-28T00:00:00Z",
      },
      { label: "ENG-42", title: "Ship release" },
      names,
    );
    expect(item).toMatchObject({
      kind: "request_confirmation",
      title: "Deploy to prod?",
      resolvable: true,
      link: "/issues/ENG-42",
      requester: "Grace",
    });
  });

  it("marks an ask_user_questions card as not resolvable (answer in issue only)", () => {
    const item = summarizeInteraction(
      { id: "int2", issueId: "iss1", kind: "ask_user_questions", status: "pending", title: null, summary: null, createdByAgentId: null, createdAt: "2026-09-28T00:00:00Z" },
      { label: "ENG-42", title: "Ship release" },
      names,
    );
    expect(item.resolvable).toBe(false);
    expect(item.title).toBe("Ship release");
  });
});

describe("buildDecisions", () => {
  it("merges pending approvals and interactions, oldest first, and drops non-pending rows", () => {
    const result = buildDecisions({
      approvals: [
        { id: "ap1", type: "hire_agent", requestedByAgentId: "a1", status: "pending", createdAt: "2026-09-28T02:00:00Z" },
        { id: "ap2", type: "spend", requestedByAgentId: "a1", status: "approved", createdAt: "2026-09-28T01:00:00Z" },
      ],
      interactions: [
        {
          row: { id: "int1", issueId: "iss1", kind: "request_confirmation", status: "pending", title: "t", summary: null, createdByAgentId: "a2", createdAt: "2026-09-28T01:00:00Z" },
          issue: { label: "ENG-1", title: "Issue 1" },
        },
        {
          row: { id: "int2", issueId: "iss2", kind: "request_confirmation", status: "accepted", title: "t2", summary: null, createdByAgentId: "a2", createdAt: "2026-09-28T00:30:00Z" },
          issue: { label: "ENG-2", title: "Issue 2" },
        },
      ],
      agentNames: names,
    });
    expect(result.map((r) => r.id)).toEqual(["interaction-int1", "approval-ap1"]);
  });
});

describe("requireUserActor", () => {
  it("returns the userId for a user actor", () => {
    expect(requireUserActor({ type: "user", userId: "u1" })).toBe("u1");
  });

  it("refuses an agent actor", () => {
    expect(() => requireUserActor({ type: "agent", userId: null })).toThrow(/user/i);
  });

  it("refuses a user actor missing an id", () => {
    expect(() => requireUserActor({ type: "user", userId: null })).toThrow();
  });
});

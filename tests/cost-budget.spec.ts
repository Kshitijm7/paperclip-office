import { describe, expect, it } from "vitest";
import { aggregateCostByAgent, formatCents, type CostEventRow , formatSpend } from "../src/shared/cost.js";
import { openBudgetIncidents, overBudgetAgentIds, type BudgetIncidentRow } from "../src/shared/budget.js";
import { buildOffice, type AgentRow, type IssueRow, type RunRow } from "../src/shared/office.js";

const now = new Date("2026-09-28T12:00:00Z");

describe("aggregateCostByAgent", () => {
  const events: CostEventRow[] = [
    { agentId: "a", costCents: 100, tokens: 0, occurredAt: "2026-09-28T01:00:00Z" }, // today
    { agentId: "a", costCents: 250, tokens: 0, occurredAt: "2026-09-27T01:00:00Z" }, // yesterday, in window
    { agentId: "b", costCents: 50, tokens: 0, occurredAt: "2026-09-28T10:00:00Z" }, // today
  ];

  it("sums total and same-day cost per agent", () => {
    const byAgent = aggregateCostByAgent(events, now);
    expect(byAgent.get("a")).toEqual({ costCents: 350, costTodayCents: 100, tokens: 0, tokensToday: 0 });
    expect(byAgent.get("b")).toEqual({ costCents: 50, costTodayCents: 50, tokens: 0, tokensToday: 0 });
    expect(byAgent.get("c")).toBeUndefined();
  });

  it("formats cents as USD", () => {
    expect(formatCents(350)).toBe("$3.50");
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("budget incidents", () => {
  const rows: BudgetIncidentRow[] = [
    { id: "1", scopeType: "agent", scopeId: "a", scopeName: "Ada", metric: "billed_cents", amountLimit: 1000, amountObserved: 1200, status: "open" },
    { id: "2", scopeType: "company", scopeId: "co1", scopeName: "Acme", metric: "billed_cents", amountLimit: 5000, amountObserved: 5100, status: "open" },
    { id: "3", scopeType: "agent", scopeId: "b", scopeName: "Bo", metric: "billed_cents", amountLimit: 1000, amountObserved: 400, status: "resolved" },
  ];

  it("keeps only open incidents", () => {
    expect(openBudgetIncidents(rows).map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("flags only agent-scoped open incidents as over budget", () => {
    const ids = overBudgetAgentIds(openBudgetIncidents(rows));
    expect(ids.has("a")).toBe(true);
    expect(ids.has("co1")).toBe(false);
    expect(ids.has("b")).toBe(false);
  });
});

describe("buildOffice cost and budget wiring", () => {
  const agents: AgentRow[] = [
    { id: "c", name: "Chief", role: "ceo", title: "Chief", reportsTo: null, status: "active" },
    { id: "a", name: "Ada", role: "engineer", title: null, reportsTo: "c", status: "idle" },
  ];
  const runs: RunRow[] = [];
  const issues: IssueRow[] = [];
  const costEvents: CostEventRow[] = [{ agentId: "a", costCents: 500, tokens: 0, occurredAt: "2026-09-28T01:00:00Z" }];
  const budgetIncidents: BudgetIncidentRow[] = [
    { id: "1", scopeType: "agent", scopeId: "a", scopeName: "Ada", metric: "billed_cents", amountLimit: 100, amountObserved: 500, status: "open" },
  ];

  it("attaches cost totals and overBudget to the matching agent only", () => {
    const office = buildOffice(agents, runs, issues, now, 10, undefined, costEvents, budgetIncidents);
    const byId = Object.fromEntries(office.agents.map((a) => [a.id, a]));
    expect(byId.a.costCents).toBe(500);
    expect(byId.a.costTodayCents).toBe(500);
    expect(byId.a.overBudget).toBe(true);
    expect(byId.c.costCents).toBe(0);
    expect(byId.c.overBudget).toBe(false);
    expect(office.budgetIncidents).toHaveLength(1);
  });

  it("defaults to no cost and no incidents when omitted", () => {
    const office = buildOffice(agents, runs, issues, now, 10);
    expect(office.agents.every((a) => a.costCents === 0 && !a.overBudget)).toBe(true);
    expect(office.budgetIncidents).toEqual([]);
  });
});

describe("formatSpend", () => {
  it("shows tokens in auto mode when there is no dollar spend", () => {
    expect(formatSpend(0, 1_500_000, "auto")).toBe("1.5M tok");
    expect(formatSpend(1234, 1_500_000, "auto")).toBe("$12.34");
    expect(formatSpend(0, 0, "auto")).toBe("$0.00");
    expect(formatSpend(1234, 900, "tokens")).toBe("900 tok");
  });
});

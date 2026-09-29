import type { AgentRow, IssueRow } from "./office.js";
import type { CostEventRow } from "./cost.js";
import { aggregateCostByAgent } from "./cost.js";

export interface AgentScores {
  productivity: number;
  efficiency: number;
  flag: string | null;
  lastCheckedAt: string | null;
}

const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const DONE_STATUSES = new Set(["done"]);

function priorityWeight(priority: string | null | undefined): number {
  return PRIORITY_WEIGHT[priority ?? "medium"] ?? PRIORITY_WEIGHT.medium;
}

function normalize(value: number, max: number): number {
  if (max <= 0 || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

/** Weighted output: done issues in the window, weighted by priority; subtasks (issues with a parent) count too. */
export function outputPoints(issues: IssueRow[], agentId: string, cutoffMs: number): number {
  let points = 0;
  for (const i of issues) {
    if (i.assigneeAgentId !== agentId || !DONE_STATUSES.has(i.status) || !i.updatedAt) continue;
    if (Date.parse(i.updatedAt) <= cutoffMs) continue;
    points += priorityWeight((i as { priority?: string }).priority);
  }
  return points;
}

export interface ScoreWeights {
  /** Minutes stuck or blocked, subtracted from an agent's efficiency spend basis. */
  efficiencyStuckPenalty: number;
}

/**
 * Pure scoring: productivity and efficiency, each 0-100, normalized against the company's best agent.
 * outputByAgent: weighted output points per agent in the window.
 * spendByAgent: cost or token spend per agent in the same window (whichever `costMetric` resolves to).
 * stuckMinutesByAgent: minutes each agent spent stuck/blocked or long in-progress, for the efficiency penalty.
 */
export function computeScores(
  agentIds: string[],
  outputByAgent: Map<string, number>,
  spendByAgent: Map<string, number>,
  stuckMinutesByAgent: Map<string, number>,
  weights: ScoreWeights,
): Map<string, { productivity: number; efficiency: number }> {
  const maxOutput = Math.max(0, ...agentIds.map((id) => outputByAgent.get(id) ?? 0));

  const rawEfficiency = new Map<string, number>();
  for (const id of agentIds) {
    const output = outputByAgent.get(id) ?? 0;
    const spend = spendByAgent.get(id) ?? 0;
    const stuck = stuckMinutesByAgent.get(id) ?? 0;
    if (output === 0 && spend === 0) {
      rawEfficiency.set(id, 0);
      continue;
    }
    const perSpend = spend > 0 ? output / spend : output;
    const penalty = 1 / (1 + stuck * weights.efficiencyStuckPenalty);
    rawEfficiency.set(id, perSpend * penalty);
  }
  const maxEfficiency = Math.max(0, ...rawEfficiency.values());

  const out = new Map<string, { productivity: number; efficiency: number }>();
  for (const id of agentIds) {
    out.set(id, {
      productivity: normalize(outputByAgent.get(id) ?? 0, maxOutput),
      efficiency: normalize(rawEfficiency.get(id) ?? 0, maxEfficiency),
    });
  }
  return out;
}

export interface ScoreContext {
  windowDays: number;
  efficiencyStuckPenalty: number;
  costMetric: "auto" | "dollars" | "tokens";
}

/** Builds the inputs from raw rows, then delegates to the pure computeScores. */
export function scoreAgents(
  agents: AgentRow[],
  issues: IssueRow[],
  costEvents: CostEventRow[],
  stuckMinutesByAgent: Map<string, number>,
  now: Date,
  ctx: ScoreContext,
): Map<string, { productivity: number; efficiency: number }> {
  const cutoffMs = now.getTime() - ctx.windowDays * 24 * 60 * 60_000;
  const outputByAgent = new Map<string, number>();
  for (const a of agents) outputByAgent.set(a.id, outputPoints(issues, a.id, cutoffMs));

  const costByAgent = aggregateCostByAgent(
    costEvents.filter((e) => Date.parse(e.occurredAt) > cutoffMs),
    now,
  );
  const spendByAgent = new Map<string, number>();
  for (const a of agents) {
    const cost = costByAgent.get(a.id);
    const useTokens = ctx.costMetric === "tokens" || (ctx.costMetric === "auto" && (cost?.costCents ?? 0) === 0);
    spendByAgent.set(a.id, useTokens ? (cost?.tokens ?? 0) : (cost?.costCents ?? 0));
  }

  return computeScores(
    agents.map((a) => a.id),
    outputByAgent,
    spendByAgent,
    stuckMinutesByAgent,
    { efficiencyStuckPenalty: ctx.efficiencyStuckPenalty },
  );
}

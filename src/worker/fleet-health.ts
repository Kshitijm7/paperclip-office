import type { PluginContext } from "@paperclipai/plugin-sdk";

/** Cached input tokens per run above which a session is replaying too much history (matches fleet-poll's reset). */
export const REPLAY_LIMIT = 30_000_000;
const SHORT_RUN_MS = 90_000;
const WINDOW_HOURS = 24;
const TOP = 5;

export interface FleetRun {
  agentId: string;
  startedAt: string | null;
  finishedAt: string | null;
  cachedInputTokens: number;
  costUsd: number;
  wakeReason: string | null;
}

export interface FleetAgent {
  id: string;
  name: string;
  status: string;
  runtimeConfig?: unknown;
}

export interface FleetIssue {
  title: string;
  status: string;
  createdAt: string | null;
}

export interface FleetApproval {
  id: string;
  type: string;
  createdAt: string;
}

export interface SpenderLine { agentId: string; runs: number; maxCached: number; avgCached: number; lastCached: number; costUsd: number }
export interface ChurnLine { agentId: string; runs: number; short: number; monitorDue: number; continuation: number }

export interface FleetHealth {
  runs: number;
  costUsd: number;
  spenders: SpenderLine[];
  churn: ChurnLine[];
  inError: string[];
  missingRotation: string[];
  relay: { total: number; open: number };
  oldestApprovals: { id: string; type: string; ageHours: number }[];
}

const hasRotation = (rc: unknown): boolean => {
  const sc = (rc as { heartbeat?: { sessionCompaction?: { enabled?: unknown } } } | null | undefined)?.heartbeat?.sessionCompaction;
  return sc?.enabled === true;
};

/** Pure: the fleet's last-24h health from runs, agents, issues and pending approvals. */
export function buildFleetHealth(runs: FleetRun[], agents: FleetAgent[], issues: FleetIssue[], approvals: FleetApproval[], now: Date): FleetHealth {
  const since = now.getTime() - WINDOW_HOURS * 3_600_000;
  const byAgent = new Map<string, FleetRun[]>();
  for (const r of runs) byAgent.set(r.agentId, [...(byAgent.get(r.agentId) ?? []), r]);

  const spenders: SpenderLine[] = [...byAgent].map(([agentId, rs]) => {
    const cached = rs.map((r) => r.cachedInputTokens);
    return {
      agentId,
      runs: rs.length,
      maxCached: Math.max(0, ...cached),
      avgCached: Math.round(cached.reduce((s, c) => s + c, 0) / rs.length),
      lastCached: [...rs].sort((a, b) => Date.parse(b.startedAt ?? "") - Date.parse(a.startedAt ?? ""))[0].cachedInputTokens,
      costUsd: rs.reduce((s, r) => s + r.costUsd, 0),
    };
  }).sort((a, b) => b.avgCached - a.avgCached || a.agentId.localeCompare(b.agentId)).slice(0, TOP);

  const churn: ChurnLine[] = [...byAgent].map(([agentId, rs]) => ({
    agentId,
    runs: rs.length,
    short: rs.filter((r) => r.startedAt && r.finishedAt && Date.parse(r.finishedAt) - Date.parse(r.startedAt) < SHORT_RUN_MS).length,
    monitorDue: rs.filter((r) => r.wakeReason === "issue_monitor_due").length,
    continuation: rs.filter((r) => r.wakeReason === "issue_continuation_needed").length,
  })).filter((c) => c.short + c.monitorDue + c.continuation > 0)
    .sort((a, b) => (b.short + b.monitorDue + b.continuation) - (a.short + a.monitorDue + a.continuation) || a.agentId.localeCompare(b.agentId))
    .slice(0, TOP);

  const relayIssues = issues.filter((i) => /\b(courier|relay)\b/i.test(i.title) && i.createdAt && Date.parse(i.createdAt) >= since);
  const live = agents.filter((a) => a.status !== "terminated");

  return {
    runs: runs.length,
    costUsd: runs.reduce((s, r) => s + r.costUsd, 0),
    spenders,
    churn,
    inError: live.filter((a) => a.status === "error").map((a) => a.id),
    missingRotation: live.filter((a) => !hasRotation(a.runtimeConfig)).map((a) => a.id),
    relay: { total: relayIssues.length, open: relayIssues.filter((i) => !["done", "cancelled"].includes(i.status)).length },
    oldestApprovals: [...approvals].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(0, 3)
      .map((a) => ({ id: a.id, type: a.type, ageHours: Math.floor((now.getTime() - Date.parse(a.createdAt)) / 3_600_000) })),
  };
}

const mTokens = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;

export function formatFleetHealth(h: FleetHealth, name: (id: string) => string): string[] {
  const lines = ["", `### Fleet health (last ${WINDOW_HOURS}h: ${h.runs} runs, $${h.costUsd.toFixed(0)})`];
  lines.push("", "Top spenders by cached tokens per run:");
  if (h.spenders.length === 0) lines.push("- no finished runs");
  for (const s of h.spenders) {
    // Judged on the latest run, so an agent whose session was already reset today is not flagged again.
    const hog = s.lastCached > REPLAY_LIMIT ? " **latest run replayed too much history, reset its session**" : "";
    lines.push(`- ${name(s.agentId)}: ${s.runs} runs, avg ${mTokens(s.avgCached)}, max ${mTokens(s.maxCached)}, latest ${mTokens(s.lastCached)}, $${s.costUsd.toFixed(0)}${hog}`);
  }
  lines.push("", "Wake churn:");
  if (h.churn.length === 0) lines.push("- none");
  for (const c of h.churn) lines.push(`- ${name(c.agentId)}: ${c.short} of ${c.runs} runs under 90 s, ${c.monitorDue} monitor wakes, ${c.continuation} continuation wakes`);
  lines.push("", `Agents in error: ${h.inError.length ? h.inError.map(name).join(", ") : "none"}`);
  lines.push(`Missing session rotation: ${h.missingRotation.length ? h.missingRotation.map(name).join(", ") : "none"}`);
  lines.push(`Relay issues: ${h.relay.total} created, ${h.relay.open} still open`);
  lines.push(`Oldest waiting on the owner: ${h.oldestApprovals.length ? h.oldestApprovals.map((a) => `${a.type} (${a.ageHours}h)`).join(", ") : "none"}`);
  return lines;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const iso = (v: unknown) => (!v ? null : v instanceof Date ? v.toISOString() : String(v));

export async function loadFleetRuns(ctx: PluginContext, companyId: string, now: Date): Promise<FleetRun[]> {
  const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000).toISOString();
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT agent_id, started_at, finished_at, usage_json, context_snapshot ->> 'wakeReason' AS wake_reason
       FROM public.heartbeat_runs
      WHERE company_id = $1 AND created_at > $2
      ORDER BY created_at DESC
      LIMIT 3000`,
    [companyId, since],
  );
  return rows.map((r) => {
    const u = (typeof r.usage_json === "string" ? JSON.parse(r.usage_json) : r.usage_json) as Record<string, unknown> | null;
    return {
      agentId: String(r.agent_id),
      startedAt: iso(r.started_at),
      finishedAt: iso(r.finished_at),
      cachedInputTokens: num(u?.cachedInputTokens),
      costUsd: num(u?.costUsd),
      wakeReason: r.wake_reason ? String(r.wake_reason) : null,
    };
  });
}

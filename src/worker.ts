import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";
import {
  DATA_KEY,
  buildOffice,
  diffHandoffs,
  type AgentRow,
  type Handoff,
  type IssueRow,
  type RunRow,
} from "./shared/office.js";
import { ACTIVITY_DATA_KEY } from "./shared/activity.js";
import { normalize, type OfficeSettings } from "./shared/settings.js";
import { loadActivity, loadPendingApprovals } from "./worker/activity-loader.js";
import { loadDecisions } from "./worker/decisions-loader.js";
import { registerDecisions } from "./worker/decisions.js";
import { DECISIONS_DATA_KEY } from "./shared/decisions.js";
import type { CostEventRow } from "./shared/cost.js";
import type { BudgetIncidentRow } from "./shared/budget.js";
import { loadAgentDetail } from "./worker/agent-detail.js";
import { registerOfficeStatusTool } from "./worker/office-status-tool.js";
import { loadLayout, registerLayout } from "./worker/layout.js";
import { LAYOUT_PRESETS } from "./layout/presets.js";
import { resolveLayout, type EffectiveLayout } from "./shared/layout.js";
import { computeRecognition, RECOGNITION_CONFIG, type RunEvent } from "./worker/recognition.js";
import { maybeRunPaCheck } from "./worker/pa.js";

const ISSUE_LIMIT = 500;
const HANDOFF_KEEP_MS = 60_000;

const lastIssues = new Map<string, IssueRow[]>();
const recentHandoffs = new Map<string, Handoff[]>();

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

async function loadRuns(ctx: PluginContext, companyId: string): Promise<RunRow[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT DISTINCT ON (agent_id) agent_id, id, status, started_at, finished_at, last_output_at, stdout_excerpt
       FROM public.heartbeat_runs
      WHERE company_id = $1 AND created_at > now() - interval '1 day'
      ORDER BY agent_id, created_at DESC`,
    [companyId],
  );
  return rows.map((r) => ({
    agentId: String(r.agent_id),
    runId: String(r.id),
    status: String(r.status),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    lastOutputAt: iso(r.last_output_at),
    excerpt: r.stdout_excerpt ? String(r.stdout_excerpt) : null,
  }));
}

async function loadRunEvents(ctx: PluginContext, companyId: string): Promise<RunEvent[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT agent_id, status, created_at
       FROM public.heartbeat_runs
      WHERE company_id = $1 AND created_at > now() - interval '${RECOGNITION_CONFIG.monthDays} days'`,
    [companyId],
  );
  return rows.map((r) => ({ agentId: String(r.agent_id), status: String(r.status), createdAt: iso(r.created_at) ?? new Date(0).toISOString() }));
}

async function loadSettings(ctx: PluginContext, companyId: string): Promise<OfficeSettings> {
  const config = await ctx.config.get(companyId);
  return normalize(config);
}

async function loadCostEvents(ctx: PluginContext, companyId: string, windowDays: number): Promise<CostEventRow[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT agent_id, cost_cents, input_tokens, output_tokens, occurred_at
       FROM public.cost_events
      WHERE company_id = $1 AND occurred_at > now() - interval '${windowDays} days'`,
    [companyId],
  );
  return rows.map((r) => ({
    agentId: String(r.agent_id),
    costCents: Number(r.cost_cents),
    tokens: Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0),
    occurredAt: iso(r.occurred_at) ?? new Date(0).toISOString(),
  }));
}

async function loadBudgetIncidents(ctx: PluginContext, companyId: string): Promise<BudgetIncidentRow[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT id, scope_type, scope_id, metric, amount_limit, amount_observed, status
       FROM public.budget_incidents
      WHERE company_id = $1 AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 50`,
    [companyId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    scopeType: String(r.scope_type),
    scopeId: String(r.scope_id),
    scopeName: String(r.scope_type),
    metric: String(r.metric),
    amountLimit: Number(r.amount_limit),
    amountObserved: Number(r.amount_observed),
    status: String(r.status),
  }));
}

/** Optional data must never take the whole office down; log and show nothing instead. */
async function optional<T>(ctx: PluginContext, label: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (err) {
    ctx.logger.warn(`office: ${label} unavailable`, { error: String(err).slice(0, 200) });
    return [];
  }
}

/** Plugin state can be unavailable (older host, missing grant); the settings default still draws a floor. */
async function safeLayout(ctx: PluginContext, companyId: string, settings: OfficeSettings): Promise<EffectiveLayout> {
  try {
    return await loadLayout(ctx, companyId, settings);
  } catch (err) {
    ctx.logger.warn("office: saved layout unavailable", { error: String(err).slice(0, 200) });
    const presets = LAYOUT_PRESETS.map(({ id, label }) => ({ id, label }));
    return { ...resolveLayout(settings, null, null), presets, agent: null, request: null };
  }
}

async function loadSnapshot(ctx: PluginContext, companyId: string) {
  const [agents, issues, runs, settings] = await Promise.all([
    ctx.agents.list({ companyId, limit: 500 }),
    ctx.issues.list({ companyId, limit: ISSUE_LIMIT }),
    loadRuns(ctx, companyId),
    loadSettings(ctx, companyId),
  ]);
  const [costEvents, budgetIncidents] = await Promise.all([
    settings.showCost ? optional(ctx, "cost", () => loadCostEvents(ctx, companyId, settings.costWindowDays)) : Promise.resolve([]),
    settings.budgetAlerts ? optional(ctx, "budget incidents", () => loadBudgetIncidents(ctx, companyId)) : Promise.resolve([]),
  ]);
  const agentRows: AgentRow[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role ?? null,
    title: a.title ?? null,
    reportsTo: a.reportsTo ?? null,
    status: a.status,
  }));
  const issueRows: IssueRow[] = issues.map((i) => ({
    id: i.id,
    identifier: i.identifier ?? null,
    title: i.title,
    status: i.status,
    assigneeAgentId: i.assigneeAgentId ?? null,
    parentId: i.parentId ?? null,
    updatedAt: iso(i.updatedAt),
    priority: (i as { priority?: string }).priority ?? "medium",
  }));
  return { agents, agentRows, issueRows, runs, settings, minutes: settings.stuckMinutes, costEvents, budgetIncidents };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register(DATA_KEY, async (params) => {
      const companyId = String((params as { companyId?: string }).companyId ?? "");
      if (!companyId) throw new Error("companyId is required");

      const { agentRows, issueRows, runs, minutes, settings, costEvents, budgetIncidents } = await loadSnapshot(ctx, companyId);
      const now = new Date();
      const fresh = diffHandoffs(lastIssues.get(companyId), issueRows, now);
      lastIssues.set(companyId, issueRows);
      const handoffs = [...(recentHandoffs.get(companyId) ?? []), ...fresh].filter(
        (h) => now.getTime() - Date.parse(h.at) < HANDOFF_KEEP_MS,
      );
      recentHandoffs.set(companyId, handoffs);

      const office = buildOffice(agentRows, runs, issueRows, now, minutes, settings, costEvents, budgetIncidents);
      if (settings.scoring && settings.paEnabled) {
        const flags = await maybeRunPaCheck(ctx, companyId, office.agents, settings.paEnabled, settings.paReports, settings.paIntervalMinutes, now);
        for (const a of office.agents) {
          const f = flags.get(a.id);
          if (f && a.scores) a.scores = { ...a.scores, flag: f.flag, lastCheckedAt: f.lastCheckedAt };
        }
      }
      const stuck = office.agents.filter((a) => a.stuck).length;
      await ctx.metrics.write("office.stuck_agents", stuck, { companyId });
      const approvals = settings.askBoard
        ? await optional(ctx, "approvals", () => loadPendingApprovals(ctx, companyId))
        : [];
      const layout = await safeLayout(ctx, companyId, settings);
      return { ...office, handoffs, approvals, layout };
    });

    ctx.data.register("agent", async (params) => {
      const p = params as { companyId?: string; agentId?: string };
      const companyId = String(p.companyId ?? "");
      const agentId = String(p.agentId ?? "");
      if (!companyId || !agentId) throw new Error("companyId and agentId are required");

      const { agents, agentRows, issueRows, runs, minutes, settings, costEvents, budgetIncidents } = await loadSnapshot(ctx, companyId);
      return loadAgentDetail(ctx, companyId, agentId, agents, agentRows, issueRows, runs, minutes, costEvents, budgetIncidents, settings.showCost ? settings.costMetric : null);
    });

    ctx.data.register("recognition", async (params) => {
      const companyId = String((params as { companyId?: string }).companyId ?? "");
      if (!companyId) throw new Error("companyId is required");

      const [{ agentRows, issueRows }, runEvents] = await Promise.all([loadSnapshot(ctx, companyId), loadRunEvents(ctx, companyId)]);
      return computeRecognition(agentRows, issueRows, runEvents, new Date());
    });

    ctx.data.register(ACTIVITY_DATA_KEY, async (params) => {
      const p = params as { companyId?: string; since?: string; limit?: number };
      const companyId = String(p.companyId ?? "");
      if (!companyId) throw new Error("companyId is required");

      const settings = await loadSettings(ctx, companyId);
      const events = await loadActivity(ctx, companyId, settings, { since: p.since, limit: p.limit });
      return { events };
    });

    ctx.data.register(DECISIONS_DATA_KEY, async (params) => {
      const companyId = String((params as { companyId?: string }).companyId ?? "");
      if (!companyId) throw new Error("companyId is required");

      const settings = await loadSettings(ctx, companyId);
      if (!settings.decisionBox) return { items: [] };
      const items = await optional(ctx, "decisions", async () => (await loadDecisions(ctx, companyId, settings.decisionIssueScan)).items);
      return { items };
    });

    registerOfficeStatusTool(ctx, (companyId) => loadSnapshot(ctx, companyId));
    registerLayout(ctx, (companyId) => loadSettings(ctx, companyId), async (companyId) => (await loadSnapshot(ctx, companyId)).agentRows);
    registerDecisions(ctx);
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);

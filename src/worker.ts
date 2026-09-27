import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";
import {
  DATA_KEY,
  DEFAULT_STUCK_MINUTES,
  buildOffice,
  diffHandoffs,
  type AgentRow,
  type Handoff,
  type IssueRow,
  type RunRow,
} from "./shared/office.js";
import { loadAgentDetail } from "./worker/agent-detail.js";

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

async function stuckMinutes(ctx: PluginContext, companyId: string): Promise<number> {
  const config = (await ctx.config.get(companyId)) as { stuckMinutes?: number } | null;
  return config?.stuckMinutes ?? DEFAULT_STUCK_MINUTES;
}

async function loadSnapshot(ctx: PluginContext, companyId: string) {
  const [agents, issues, runs, minutes] = await Promise.all([
    ctx.agents.list({ companyId, limit: 500 }),
    ctx.issues.list({ companyId, limit: ISSUE_LIMIT }),
    loadRuns(ctx, companyId),
    stuckMinutes(ctx, companyId),
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
  }));
  return { agents, agentRows, issueRows, runs, minutes };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register(DATA_KEY, async (params) => {
      const companyId = String((params as { companyId?: string }).companyId ?? "");
      if (!companyId) throw new Error("companyId is required");

      const { agentRows, issueRows, runs, minutes } = await loadSnapshot(ctx, companyId);
      const now = new Date();
      const fresh = diffHandoffs(lastIssues.get(companyId), issueRows, now);
      lastIssues.set(companyId, issueRows);
      const handoffs = [...(recentHandoffs.get(companyId) ?? []), ...fresh].filter(
        (h) => now.getTime() - Date.parse(h.at) < HANDOFF_KEEP_MS,
      );
      recentHandoffs.set(companyId, handoffs);

      const office = buildOffice(agentRows, runs, issueRows, now, minutes);
      const stuck = office.agents.filter((a) => a.stuck).length;
      await ctx.metrics.write("office.stuck_agents", stuck, { companyId });
      return { ...office, handoffs };
    });

    ctx.data.register("agent", async (params) => {
      const p = params as { companyId?: string; agentId?: string };
      const companyId = String(p.companyId ?? "");
      const agentId = String(p.agentId ?? "");
      if (!companyId || !agentId) throw new Error("companyId and agentId are required");

      const { agents, agentRows, issueRows, runs, minutes } = await loadSnapshot(ctx, companyId);
      return loadAgentDetail(ctx, companyId, agentId, agents, agentRows, issueRows, runs, minutes);
    });
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);

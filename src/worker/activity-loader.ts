import type { PluginContext } from "@paperclipai/plugin-sdk";
import { buildActivity, pendingApprovals, type ActivityApprovalRow, type ActivityCommentRow, type ActivityEvent, type ActivityRunRow } from "../shared/activity.js";
import type { OfficeSettings } from "../shared/settings.js";

const ISSUE_LIMIT = 500;
const COMMENT_LIMIT = 500;
const RUN_ROW_LIMIT = 500;

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

async function loadCommentRows(ctx: PluginContext, companyId: string, sinceIso: string): Promise<ActivityCommentRow[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT id, issue_id, author_agent_id, created_at
       FROM public.issue_comments
      WHERE company_id = $1 AND created_at > $2 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $3`,
    [companyId, sinceIso, COMMENT_LIMIT],
  );
  return rows.map((r) => ({
    id: String(r.id),
    issueId: String(r.issue_id),
    authorAgentId: r.author_agent_id ? String(r.author_agent_id) : null,
    createdAt: iso(r.created_at) ?? sinceIso,
  }));
}

async function loadRunRows(ctx: PluginContext, companyId: string, sinceIso: string): Promise<ActivityRunRow[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT id, agent_id, status, started_at, finished_at
       FROM public.heartbeat_runs
      WHERE company_id = $1 AND (started_at > $2 OR finished_at > $2)
      ORDER BY created_at DESC
      LIMIT $3`,
    [companyId, sinceIso, RUN_ROW_LIMIT],
  );
  return rows.map((r) => ({
    id: String(r.id),
    agentId: String(r.agent_id),
    status: String(r.status),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
  }));
}

export async function loadActivity(
  ctx: PluginContext,
  companyId: string,
  settings: OfficeSettings,
  params: { since?: string; limit?: number },
): Promise<ActivityEvent[]> {
  const since = params.since ? new Date(params.since) : new Date(Date.now() - settings.activityWindowHours * 3_600_000);
  const sinceIso = since.toISOString();
  const limit = params.limit ?? settings.activityLimit;

  const [agents, issues, approvals, comments, runs] = await Promise.all([
    ctx.agents.list({ companyId, limit: 500 }),
    ctx.issues.list({ companyId, limit: ISSUE_LIMIT }),
    ctx.approvals.list({ companyId }),
    loadCommentRows(ctx, companyId, sinceIso),
    loadRunRows(ctx, companyId, sinceIso),
  ]);

  const agentNames = new Map(agents.map((a) => [a.id, a.name]));
  const issueLabels = new Map(issues.map((i) => [i.id, { label: i.identifier ?? i.id.slice(0, 8), title: i.title }]));

  return buildActivity({
    issues: issues.map((i) => ({
      id: i.id,
      identifier: i.identifier ?? null,
      title: i.title,
      status: i.status,
      createdAt: iso(i.createdAt),
      updatedAt: iso(i.updatedAt),
    })),
    comments,
    runs,
    approvals: approvals.map((a) => ({
      id: a.id,
      type: a.type,
      requestedByAgentId: a.requestedByAgentId,
      status: a.status,
      createdAt: iso(a.createdAt) ?? sinceIso,
      decidedAt: iso(a.decidedAt),
    })),
    agentNames,
    issueLabels,
    since,
    limit,
  });
}

/** Pending approvals, oldest first, for the office's ASK ME board. */
export async function loadPendingApprovals(ctx: PluginContext, companyId: string): Promise<ActivityApprovalRow[]> {
  const approvals = await ctx.approvals.list({ companyId });
  return pendingApprovals(
    approvals.map((a) => ({
      id: a.id,
      type: a.type,
      requestedByAgentId: a.requestedByAgentId,
      status: a.status,
      createdAt: iso(a.createdAt) ?? new Date(0).toISOString(),
      decidedAt: iso(a.decidedAt),
    })),
  );
}

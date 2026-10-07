import type { CostMetric } from "../shared/cost.js";
import type { Agent, PluginContext } from "@paperclipai/plugin-sdk";
import { buildOffice, DEFAULT_STUCK_MINUTES, type AgentRow, type IssueRow, type OfficeAgent, type RunRow } from "../shared/office.js";
import type { CostEventRow } from "../shared/cost.js";
import type { BudgetIncidentRow } from "../shared/budget.js";

const RUN_LIMIT = 5;
const OPEN_ISSUE_LIMIT = 10;
const DONE_ISSUE_LIMIT = 5;
const EXCERPT_CHARS = 800;
const OPEN_STATUSES = new Set(["todo", "in_progress", "in_review", "blocked"]);

export interface AgentDetailRun {
  runId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastOutputAt: string | null;
  invocationSource: string | null;
  error: string | null;
  stdoutExcerpt: string | null;
}

export interface AgentDetailIssue {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
}

export interface AgentDetail {
  agent: { id: string; name: string; role: string | null; title: string | null; status: string; icon: string | null };
  office: OfficeAgent;
  manager: { id: string; name: string } | null;
  reports: Array<{ id: string; name: string }>;
  openIssues: AgentDetailIssue[];
  doneIssues: AgentDetailIssue[];
  runs: AgentDetailRun[];
  cost: CostMetric | null;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function tail(text: string | null, chars: number): string | null {
  if (!text) return null;
  return text.length > chars ? text.slice(-chars) : text;
}

async function loadDetailRuns(ctx: PluginContext, companyId: string, agentId: string, viewOnly = false): Promise<AgentDetailRun[]> {
  // In view-only mode raw run output is never read; the detail shows status only.
  const excerptCol = viewOnly ? "NULL AS stdout_excerpt" : "stdout_excerpt";
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT id, status, started_at, finished_at, last_output_at, invocation_source, error, ${excerptCol}
       FROM public.heartbeat_runs
      WHERE company_id = $1 AND agent_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [companyId, agentId, RUN_LIMIT],
  );
  return rows.map((r) => ({
    runId: String(r.id),
    status: String(r.status),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    lastOutputAt: iso(r.last_output_at),
    invocationSource: r.invocation_source ? String(r.invocation_source) : null,
    error: r.error ? String(r.error) : null,
    stdoutExcerpt: tail(r.stdout_excerpt ? String(r.stdout_excerpt) : null, EXCERPT_CHARS),
  }));
}

/** Reuses buildOffice so the modal's state/stuck reasoning stays identical to the office scene's. */
export async function loadAgentDetail(
  ctx: PluginContext,
  companyId: string,
  agentId: string,
  agents: Agent[],
  agentRows: AgentRow[],
  issueRows: IssueRow[],
  runRows: RunRow[],
  stuckMinutes = DEFAULT_STUCK_MINUTES,
  costEvents: CostEventRow[] = [],
  budgetIncidents: BudgetIncidentRow[] = [],
  cost: CostMetric | null = "auto",
  viewOnly = false,
): Promise<AgentDetail> {
  const office = buildOffice(agentRows, runRows, issueRows, new Date(), stuckMinutes, undefined, costEvents, budgetIncidents);
  const target = office.agents.find((a) => a.id === agentId);
  const full = agents.find((a) => a.id === agentId);
  if (!target || !full) throw new Error(`agent ${agentId} not found`);

  const byId = new Map(agentRows.map((a) => [a.id, a]));
  const manager = target.reportsTo ? byId.get(target.reportsTo) : undefined;
  const reports = agentRows.filter((a) => a.reportsTo === agentId).map((a) => ({ id: a.id, name: a.name }));

  const mine = issueRows.filter((i) => i.assigneeAgentId === agentId);
  const openIssues = mine
    .filter((i) => OPEN_STATUSES.has(i.status))
    .slice(0, OPEN_ISSUE_LIMIT)
    .map((i) => ({ id: i.id, identifier: i.identifier, title: i.title, status: i.status }));
  const doneIssues = mine
    .filter((i) => i.status === "done")
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, DONE_ISSUE_LIMIT)
    .map((i) => ({ id: i.id, identifier: i.identifier, title: i.title, status: i.status }));

  const runs = await loadDetailRuns(ctx, companyId, agentId, viewOnly);

  return {
    agent: { id: full.id, name: full.name, role: full.role, title: full.title, status: full.status, icon: full.icon },
    office: target,
    manager: manager ? { id: manager.id, name: manager.name } : null,
    reports,
    openIssues,
    doneIssues,
    runs,
    cost,
  };
}

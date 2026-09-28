import type { EffectiveLayout } from "./layout.js";
import type { ActivityApprovalRow } from "./activity.js";
import { buildDepartments } from "./org.js";
import { computeLevels, type LevelName } from "./levels.js";
import { DEFAULTS, type OfficeSettings } from "./settings.js";
import { aggregateCostByAgent, type CostEventRow } from "./cost.js";
import { openBudgetIncidents, overBudgetAgentIds, type BudgetIncidentRow } from "./budget.js";

export const DATA_KEY = "office";
export const DEFAULT_STUCK_MINUTES = 10;
export const PAGE_ROUTE = "office";

export type OfficeState = "idle" | "thinking" | "working" | "blocked";

export interface AgentRow {
  id: string;
  name: string;
  role: string | null;
  title: string | null;
  reportsTo: string | null;
  status: string;
}

export interface RunRow {
  agentId: string;
  runId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastOutputAt: string | null;
  excerpt: string | null;
}

export interface IssueRow {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  assigneeAgentId: string | null;
  parentId: string | null;
  updatedAt: string | null;
}

export interface OfficeAgent {
  id: string;
  needsApproval: boolean;
  name: string;
  role: string | null;
  title: string | null;
  reportsTo: string | null;
  managerId: string | null;
  department: string;
  isChief: boolean;
  state: OfficeState;
  stuck: boolean;
  stuckReason: string | null;
  since: string | null;
  issue: { id: string; label: string; title: string; status: string } | null;
  runId: string | null;
  thought: string | null;
  justFinished: boolean;
  level: number;
  levelName: LevelName;
  reportsCount: number;
  /** Done / total child issues of the agent's current issue, or null when it has no children. */
  progress: number | null;
  /** Count of the agent's open issues (todo, in_progress, blocked, in_review). */
  queueDepth: number;
  /** Minutes since the oldest open issue in the queue last changed, or null when the queue is empty. */
  oldestWaitMinutes: number | null;
  costCents: number;
  costTodayCents: number;
  tokens: number;
  tokensToday: number;
  overBudget: boolean;
}

export interface Handoff {
  from: string;
  to: string;
  issue: string;
  at: string;
}

export interface OfficeData {
  generatedAt: string;
  stuckMinutes: number;
  agents: OfficeAgent[];
  tasks: Array<{ id: string; status: "todo" | "doing" | "done" | "blocked"; assignee?: string }>;
  handoffs: Handoff[];
  /** Pending approvals (ASK ME board); filled by the worker when the askBoard setting is on. */
  approvals?: ActivityApprovalRow[];
  settings: OfficeSettings;
  budgetIncidents: BudgetIncidentRow[];
  /** Theme and floor plan to draw: the company's saved choice, else the settings default. */
  layout?: EffectiveLayout;
}

const LIVE_RUN = new Set(["queued", "running", "scheduled_retry"]);
const ACTIVE_ISSUE = ["in_progress", "blocked", "in_review", "todo"];
const OPEN_QUEUE_STATUSES = new Set(["todo", "in_progress", "blocked", "in_review"]);
const FINISHED_WINDOW_MS = 90_000;
const DONE_WINDOW_MS = 24 * 60 * 60_000;
const THOUGHT_CHARS = 60;

function minutes(ms: number): number {
  return Math.floor(ms / 60_000);
}

function lastLine(text: string | null): string | null {
  if (!text) return null;
  const line = text.trim().split(/\r?\n/).filter(Boolean).pop()?.trim();
  if (!line) return null;
  return line.length > THOUGHT_CHARS ? line.slice(0, THOUGHT_CHARS - 1) + "…" : line;
}

function currentIssue(issues: IssueRow[], agentId: string): IssueRow | undefined {
  const mine = issues.filter((i) => i.assigneeAgentId === agentId);
  for (const status of ACTIVE_ISSUE) {
    const hit = mine.find((i) => i.status === status);
    if (hit) return hit;
  }
  return undefined;
}

export function buildOffice(
  agents: AgentRow[],
  runs: RunRow[],
  issues: IssueRow[],
  now: Date,
  stuckMinutes = DEFAULT_STUCK_MINUTES,
  settings?: OfficeSettings,
  costEvents: CostEventRow[] = [],
  budgetIncidentRows: BudgetIncidentRow[] = [],
): OfficeData {
  const runByAgent = new Map(runs.map((r) => [r.agentId, r]));
  const nowMs = now.getTime();
  const costByAgent = aggregateCostByAgent(costEvents, now);
  const openIncidents = openBudgetIncidents(budgetIncidentRows);
  const overBudgetIds = overBudgetAgentIds(openIncidents);
  const sorted = [...agents]
    .filter((a) => a.status !== "terminated")
    .sort((a, b) => a.id.localeCompare(b.id));
  const chiefId = sorted.find((a) => !a.reportsTo)?.id ?? null;
  const deptByAgent = new Map<string, string>();
  for (const d of buildDepartments(sorted)) for (const id of d.agentIds) deptByAgent.set(id, d.name);
  const levels = computeLevels(sorted, issues);

  const office = sorted.map((a): OfficeAgent => {
    const run = runByAgent.get(a.id);
    const live = run && LIVE_RUN.has(run.status) ? run : undefined;
    const issue = currentIssue(issues, a.id);
    const level = levels.get(a.id) ?? { level: 1, levelName: "Member" as const, reportsCount: 0 };
    const children = issue ? issues.filter((i) => i.parentId === issue.id) : [];
    const progress = children.length > 0 ? children.filter((i) => i.status === "done").length / children.length : null;

    let state: OfficeState = "idle";
    if (live?.lastOutputAt) state = "working";
    else if (live) state = "thinking";
    else if (issue?.status === "blocked" || a.status === "pending_approval") state = "blocked";

    const lastSignal = live ? Date.parse(live.lastOutputAt ?? live.startedAt ?? now.toISOString()) : NaN;
    let stuckReason: string | null = null;
    if (live && nowMs - lastSignal > stuckMinutes * 60_000) {
      stuckReason = `no output for ${minutes(nowMs - lastSignal)} min`;
    } else if (!live && issue?.status === "in_progress" && a.status !== "paused") {
      const quietFor = issue.updatedAt ? nowMs - Date.parse(issue.updatedAt) : Infinity;
      if (quietFor > stuckMinutes * 60_000) stuckReason = "issue in progress, no run";
    }

    const finishedAt = run?.finishedAt ? Date.parse(run.finishedAt) : NaN;
    const openQueue = issues.filter((i) => i.assigneeAgentId === a.id && OPEN_QUEUE_STATUSES.has(i.status));
    const oldestWaitMinutes =
      openQueue.length > 0
        ? minutes(nowMs - Math.min(...openQueue.map((i) => (i.updatedAt ? Date.parse(i.updatedAt) : nowMs))))
        : null;
    const cost = costByAgent.get(a.id);
    return {
      id: a.id,
      needsApproval: a.status === "pending_approval",
      name: a.name,
      role: a.role,
      title: a.title,
      reportsTo: a.reportsTo,
      managerId: a.reportsTo,
      department: deptByAgent.get(a.id) ?? "Staff",
      isChief: a.id === chiefId,
      state,
      stuck: stuckReason !== null,
      stuckReason,
      since: live?.startedAt ?? run?.finishedAt ?? null,
      issue: issue
        ? { id: issue.id, label: issue.identifier ?? issue.id.slice(0, 8), title: issue.title, status: issue.status }
        : null,
      runId: live?.runId ?? null,
      thought: live ? lastLine(live.excerpt) : null,
      justFinished: !live && run?.status === "succeeded" && nowMs - finishedAt < FINISHED_WINDOW_MS,
      level: level.level,
      levelName: level.levelName,
      reportsCount: level.reportsCount,
      progress,
      queueDepth: openQueue.length,
      oldestWaitMinutes,
      costCents: cost?.costCents ?? 0,
      costTodayCents: cost?.costTodayCents ?? 0,
      tokens: cost?.tokens ?? 0,
      tokensToday: cost?.tokensToday ?? 0,
      overBudget: overBudgetIds.has(a.id),
    };
  });

  const tasks = issues
    .filter((i) => i.assigneeAgentId && i.status !== "cancelled" && i.status !== "backlog")
    .filter((i) => i.status !== "done" || (i.updatedAt && nowMs - Date.parse(i.updatedAt) < DONE_WINDOW_MS))
    .map((i) => ({
      id: i.id,
      status: (["done", "todo", "blocked"].includes(i.status) ? i.status : "doing") as OfficeData["tasks"][number]["status"],
      assignee: i.assigneeAgentId ?? undefined,
    }));

  return {
    generatedAt: now.toISOString(),
    stuckMinutes,
    agents: office,
    tasks,
    handoffs: [],
    settings: settings ?? DEFAULTS,
    budgetIncidents: openIncidents,
  };
}

/** Envelopes between two snapshots: reassignment (old to new assignee) or a new child issue (parent's assignee to child's). */
export function diffHandoffs(prev: IssueRow[] | undefined, next: IssueRow[], now: Date): Handoff[] {
  if (!prev) return [];
  const before = new Map(prev.map((i) => [i.id, i]));
  const byId = new Map(next.map((i) => [i.id, i]));
  const out: Handoff[] = [];
  for (const issue of next) {
    const to = issue.assigneeAgentId;
    if (!to) continue;
    const old = before.get(issue.id);
    const label = issue.identifier ?? issue.title;
    if (old && old.assigneeAgentId && old.assigneeAgentId !== to) {
      out.push({ from: old.assigneeAgentId, to, issue: label, at: now.toISOString() });
    } else if (!old && issue.parentId) {
      const from = byId.get(issue.parentId)?.assigneeAgentId;
      if (from && from !== to) out.push({ from, to, issue: label, at: now.toISOString() });
    }
  }
  return out;
}

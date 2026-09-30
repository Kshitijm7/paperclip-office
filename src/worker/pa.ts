import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { OfficeAgent } from "../shared/office.js";

export interface PaCheck {
  agentId: string;
  note: string;
  flag: string | null;
  /** Consecutive rounds this agent has carried a flag, 0 when clear. */
  streak: number;
}

export interface PaFlagState {
  flag: string | null;
  lastCheckedAt: string | null;
  streak?: number;
}

export interface AgentReport {
  agentId: string;
  issueLabel: string | null;
  body: string;
  at: string;
}

export interface PaDecision {
  agentId: string;
  text: string;
}

export interface PaReportLine {
  roll: PaCheck[];
  flagged: PaCheck[];
  newFlags: PaCheck[];
  resolved: string[];
  escalated: PaCheck[];
  decisions: PaDecision[];
  reports: AgentReport[];
  topProductivity: OfficeAgent | null;
  bottomProductivity: OfficeAgent | null;
  idleWithWork: PaCheck[];
}

const ESCALATE_AFTER = 3;
const REPORT_TAIL = 200;

function minutesSince(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

/** Pure: one check note per agent, and whether it should flag. Idle agents are checked too. */
export function buildPaCheck(agent: OfficeAgent, now: Date, prior?: PaFlagState): PaCheck {
  const base = checkFor(agent, now);
  const streak = base.flag ? (prior?.flag ? (prior.streak ?? 1) + 1 : 1) : 0;
  return { agentId: agent.id, ...base, streak };
}

function checkFor(agent: OfficeAgent, now: Date): { note: string; flag: string | null } {
  const mins = minutesSince(agent.since, now);
  const label = agent.issue ? agent.issue.label : "no issue";
  if (agent.stuck) {
    return { note: `stuck on ${label} for ${mins}m: ${agent.stuckReason ?? "no output"}`, flag: agent.stuckReason ?? "stuck" };
  }
  if (agent.state === "blocked") {
    const note = agent.needsApproval ? "blocked on approval" : `blocked${agent.issue ? ` on ${agent.issue.label}` : ""}`;
    return { note: `${note} for ${mins}m`, flag: note };
  }
  if (agent.overBudget) {
    return { note: `${agent.state} on ${label}, over budget`, flag: "over budget" };
  }
  if (agent.state === "working" || agent.state === "thinking") {
    return { note: `${agent.state} on ${label} for ${mins}m`, flag: null };
  }
  if (agent.queueDepth > 0) {
    return { note: `idle with ${agent.queueDepth} issue${agent.queueDepth === 1 ? "" : "s"} waiting (oldest ${agent.oldestWaitMinutes ?? 0}m)`, flag: "idle with work waiting" };
  }
  return { note: "idle, queue empty", flag: null };
}

export function buildPaChecks(agents: OfficeAgent[], now: Date, prior: Map<string, PaFlagState> = new Map()): PaCheck[] {
  return [...agents].sort((a, b) => a.id.localeCompare(b.id)).map((a) => buildPaCheck(a, now, prior.get(a.id)));
}

/** Pure: rule-based asks for the Chief, most urgent first. */
export function buildDecisions(checks: PaCheck[], agents: OfficeAgent[]): PaDecision[] {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const free = agents.filter((a) => a.state === "idle" && a.queueDepth === 0 && !a.isChief).sort((a, b) => a.id.localeCompare(b.id));
  const decisions: PaDecision[] = [];
  const sorted = [...checks].filter((c) => c.flag).sort((a, b) => b.streak - a.streak || a.agentId.localeCompare(b.agentId));
  for (const c of sorted) {
    const a = byId.get(c.agentId);
    if (!a) continue;
    const issue = a.issue?.label ?? "its issue";
    if (a.needsApproval) {
      decisions.push({ agentId: a.id, text: `Approve or reject the pending approval for ${a.name} (${issue}).` });
    } else if (a.stuck || a.state === "blocked") {
      const peer = free.find((p) => p.department === a.department) ?? free[0];
      decisions.push({
        agentId: a.id,
        text: peer && c.streak >= 2
          ? `Reassign ${issue} from ${a.name} to ${peer.name} (idle, empty queue); ${a.name} has been ${c.flag} for ${c.streak} rounds.`
          : `Unblock ${a.name} on ${issue} (${c.flag}).`,
      });
    } else if (c.flag === "idle with work waiting") {
      decisions.push({ agentId: a.id, text: `Wake ${a.name}: ${a.queueDepth} issue(s) waiting, oldest ${a.oldestWaitMinutes ?? 0}m.` });
    } else if (c.flag === "over budget") {
      decisions.push({ agentId: a.id, text: `Review budget for ${a.name} before more runs.` });
    }
  }
  return decisions;
}

/** Pure: what goes in the report comment. Formatting stays in formatPaReport so this is easy to test. */
export function summarizePaChecks(
  checks: PaCheck[],
  agents: OfficeAgent[],
  prior: Map<string, PaFlagState> = new Map(),
  reports: AgentReport[] = [],
): PaReportLine {
  const flagged = checks.filter((c) => c.flag !== null);
  const ranked = [...agents].filter((a) => a.scores).sort((a, b) => (b.scores!.productivity - a.scores!.productivity) || a.id.localeCompare(b.id));
  return {
    roll: checks,
    flagged,
    newFlags: flagged.filter((c) => c.streak === 1),
    resolved: checks.filter((c) => !c.flag && prior.get(c.agentId)?.flag).map((c) => c.agentId),
    escalated: flagged.filter((c) => c.streak >= ESCALATE_AFTER),
    decisions: buildDecisions(checks, agents),
    reports,
    topProductivity: ranked[0] ?? null,
    bottomProductivity: ranked.length > 0 ? ranked[ranked.length - 1] : null,
    idleWithWork: flagged.filter((c) => c.flag === "idle with work waiting"),
  };
}

function tail(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > REPORT_TAIL ? `…${flat.slice(flat.length - REPORT_TAIL + 1)}` : flat;
}

export function formatPaReport(summary: PaReportLine, byId: Map<string, OfficeAgent>, round = 0): string {
  const name = (id: string) => byId.get(id)?.name ?? id;
  const lines: string[] = [];
  lines.push(`## PA round ${round}`);
  lines.push(`${summary.flagged.length} flagged, ${summary.newFlags.length} new, ${summary.resolved.length} resolved, ${summary.escalated.length} escalated.`);

  lines.push("", "### Decisions for the Chief");
  if (summary.decisions.length === 0) lines.push("None this round.");
  summary.decisions.forEach((d, i) => lines.push(`${i + 1}. ${d.text}`));

  if (summary.escalated.length > 0) {
    lines.push("", "### Escalated");
    for (const c of summary.escalated) lines.push(`- ${name(c.agentId)}: ${c.flag}, ${c.streak} rounds in a row`);
  }
  if (summary.flagged.length > 0) {
    lines.push("", "### All flags");
    for (const c of summary.flagged) lines.push(`- ${name(c.agentId)}: ${c.note}${c.streak === 1 ? " (new)" : ` (round ${c.streak})`}`);
  } else {
    lines.push("", "No flags this round.");
  }
  if (summary.resolved.length > 0) {
    lines.push("", `Resolved since last round: ${summary.resolved.map(name).join(", ")}`);
  }

  lines.push("", "### Roll call");
  for (const c of summary.roll) lines.push(`- ${name(c.agentId)}: ${c.note}`);

  if (summary.reports.length > 0) {
    lines.push("", "### Agent reports since last round");
    for (const r of summary.reports) lines.push(`- ${name(r.agentId)}${r.issueLabel ? ` on ${r.issueLabel}` : ""}: ${tail(r.body)}`);
  }

  const prod: string[] = [];
  if (summary.topProductivity) prod.push(`top ${summary.topProductivity.name} (${summary.topProductivity.scores?.productivity ?? 0})`);
  if (summary.bottomProductivity && summary.bottomProductivity.id !== summary.topProductivity?.id) {
    prod.push(`lowest ${summary.bottomProductivity.name} (${summary.bottomProductivity.scores?.productivity ?? 0})`);
  }
  if (prod.length > 0) lines.push("", `Productivity: ${prod.join(", ")}`);
  return lines.join("\n");
}

const PA_ISSUE_TITLE = "PA supervisor reports";
const state = (companyId: string, stateKey: string) => ({ scopeKind: "company" as const, scopeId: companyId, stateKey });
const LAST_RUN_KEY = "pa-last-run";
const REPORT_ISSUE_KEY = "pa-report-issue-id";
const FLAGS_KEY = "pa-flags";
const ROUND_KEY = "pa-round";
const OPEN_STATUSES = new Set(["todo", "in_progress", "in_review", "blocked"]);

function topOfOrg(agents: OfficeAgent[]): OfficeAgent | undefined {
  return agents.find((a) => a.isChief) ?? agents[0];
}

async function reportIssueId(ctx: PluginContext, companyId: string, chiefId: string): Promise<string> {
  const cached = (await ctx.state.get(state(companyId, REPORT_ISSUE_KEY))) as string | null;
  if (cached) return cached;
  const issue = await ctx.issues.create({ companyId, title: PA_ISSUE_TITLE, description: "PA supervisor report, one comment per round: decisions, flags, roll call and agent reports.", assigneeAgentId: chiefId, status: "todo" });
  await ctx.state.set(state(companyId, REPORT_ISSUE_KEY), issue.id);
  return issue.id;
}

/** Latest comment per agent since the last round, excluding the PA's own report issue. */
async function loadAgentReports(ctx: PluginContext, companyId: string, sinceIso: string, agents: OfficeAgent[], excludeIssueId: string | null): Promise<AgentReport[]> {
  const rows = await ctx.db.query<Record<string, unknown>>(
    `SELECT DISTINCT ON (author_agent_id) author_agent_id, issue_id, body, created_at
       FROM public.issue_comments
      WHERE company_id = $1 AND created_at > $2 AND deleted_at IS NULL
        AND author_agent_id IS NOT NULL AND ($3::uuid IS NULL OR issue_id <> $3::uuid)
      ORDER BY author_agent_id, created_at DESC`,
    [companyId, sinceIso, excludeIssueId],
  );
  const byId = new Map(agents.map((a) => [a.id, a]));
  return rows
    .filter((r) => byId.has(String(r.author_agent_id)))
    .map((r) => {
      const current = byId.get(String(r.author_agent_id))?.issue;
      return {
        agentId: String(r.author_agent_id),
        issueLabel: current && current.id === String(r.issue_id) ? current.label : null,
        body: String(r.body ?? ""),
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      };
    })
    .sort((a, b) => a.agentId.localeCompare(b.agentId));
}

/** Runs a PA round if `paIntervalMinutes` has elapsed since the last one; deterministic, zero LLM tokens. */
export async function maybeRunPaCheck(
  ctx: PluginContext,
  companyId: string,
  agents: OfficeAgent[],
  paEnabled: boolean,
  paReports: boolean,
  intervalMinutes: number,
  now: Date,
  healthLines?: () => Promise<string[]>,
): Promise<Map<string, PaFlagState>> {
  const priorFlagsRaw = (await ctx.state.get(state(companyId, FLAGS_KEY)).catch(() => null)) as Record<string, PaFlagState> | null;
  const priorFlags = new Map(Object.entries(priorFlagsRaw ?? {}));
  if (!paEnabled || agents.length === 0) return priorFlags;

  const lastRun = (await ctx.state.get(state(companyId, LAST_RUN_KEY)).catch(() => null)) as string | null;
  if (lastRun && now.getTime() - Date.parse(lastRun) < intervalMinutes * 60_000) return priorFlags;

  const checks = buildPaChecks(agents, now, priorFlags);
  const nowIso = now.toISOString();
  const nextFlags = new Map<string, PaFlagState>();
  for (const c of checks) nextFlags.set(c.agentId, { flag: c.flag, lastCheckedAt: nowIso, streak: c.streak });
  const round = (((await ctx.state.get(state(companyId, ROUND_KEY)).catch(() => 0)) as number | null) ?? 0) + 1;
  await ctx.state.set(state(companyId, FLAGS_KEY), Object.fromEntries(nextFlags));
  await ctx.state.set(state(companyId, LAST_RUN_KEY), nowIso);
  await ctx.state.set(state(companyId, ROUND_KEY), round);

  if (!paReports) return nextFlags;
  const chief = topOfOrg(agents);
  if (!chief) return nextFlags;
  try {
    const issueId = await reportIssueId(ctx, companyId, chief.id);
    const since = lastRun ?? new Date(now.getTime() - intervalMinutes * 60_000).toISOString();
    const reports = await loadAgentReports(ctx, companyId, since, agents, issueId).catch((err) => {
      ctx.logger.warn("office: PA could not read agent reports", { error: String(err).slice(0, 200) });
      return [] as AgentReport[];
    });
    const summary = summarizePaChecks(checks, agents, priorFlags, reports);
    const byId = new Map(agents.map((a) => [a.id, a]));
    const health = healthLines
      ? await healthLines().catch((err) => {
          ctx.logger.warn("office: PA fleet health unavailable", { error: String(err).slice(0, 200) });
          return [] as string[];
        })
      : [];
    await ctx.issues.createComment(issueId, [formatPaReport(summary, byId, round), ...health].join("\n"), companyId);

    const issue = await ctx.issues.get(issueId, companyId);
    if (issue && (!OPEN_STATUSES.has(issue.status) || issue.assigneeAgentId !== chief.id)) {
      await ctx.issues.update(issueId, { status: "todo", assigneeAgentId: chief.id }, companyId);
    }
    if (summary.decisions.length > 0 || summary.escalated.length > 0) {
      await ctx.issues.requestWakeup(issueId, companyId, { reason: `PA round ${round}: ${summary.decisions.length} decision(s)`, idempotencyKey: `pa-round-${round}` });
    }
  } catch (err) {
    ctx.logger.error("office: PA report failed", { error: String(err).slice(0, 200) });
  }
  return nextFlags;
}

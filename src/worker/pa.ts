import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { OfficeAgent } from "../shared/office.js";

export interface PaCheck {
  agentId: string;
  note: string;
  flag: string | null;
}

function minutesSince(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
}

/** Pure: one check note per agent, and whether it should flag. Idle agents are checked too. */
export function buildPaCheck(agent: OfficeAgent, now: Date): PaCheck {
  if (agent.stuck) {
    return { agentId: agent.id, note: `stuck: ${agent.stuckReason ?? "no output"}`, flag: agent.stuckReason ?? "stuck" };
  }
  if (agent.state === "blocked") {
    const note = agent.needsApproval ? "blocked on approval" : `blocked${agent.issue ? ` on ${agent.issue.label}` : ""}`;
    return { agentId: agent.id, note, flag: note };
  }
  if (agent.state === "working" || agent.state === "thinking") {
    const mins = minutesSince(agent.since, now);
    const label = agent.issue ? agent.issue.label : "no issue";
    return { agentId: agent.id, note: `${agent.state} on ${label} for ${mins}m`, flag: null };
  }
  if (agent.queueDepth > 0) {
    return { agentId: agent.id, note: `idle with ${agent.queueDepth} issue${agent.queueDepth === 1 ? "" : "s"} waiting`, flag: "idle with work waiting" };
  }
  return { agentId: agent.id, note: "idle", flag: null };
}

export function buildPaChecks(agents: OfficeAgent[], now: Date): PaCheck[] {
  return [...agents].sort((a, b) => a.id.localeCompare(b.id)).map((a) => buildPaCheck(a, now));
}

export interface PaReportLine {
  flagged: PaCheck[];
  topProductivity: OfficeAgent | null;
  bottomProductivity: OfficeAgent | null;
  idleWithWork: PaCheck[];
}

/** Pure: what goes in the report comment. Formatting stays in runPaCheck so this is easy to test. */
export function summarizePaChecks(checks: PaCheck[], agents: OfficeAgent[]): PaReportLine {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const flagged = checks.filter((c) => c.flag !== null);
  const idleWithWork = flagged.filter((c) => c.flag === "idle with work waiting");
  const ranked = [...agents].filter((a) => a.scores).sort((a, b) => (b.scores!.productivity - a.scores!.productivity) || a.id.localeCompare(b.id));
  return {
    flagged,
    topProductivity: ranked[0] ?? null,
    bottomProductivity: ranked.length > 0 ? ranked[ranked.length - 1] : null,
    idleWithWork,
  };
}

export function formatPaReport(summary: PaReportLine, byId: Map<string, OfficeAgent>): string {
  const lines: string[] = [];
  if (summary.flagged.length > 0) {
    lines.push(`Flagged: ${summary.flagged.map((c) => `${byId.get(c.agentId)?.name ?? c.agentId} (${c.flag})`).join(", ")}`);
  } else {
    lines.push("No flags this check.");
  }
  if (summary.topProductivity) lines.push(`Top productivity: ${summary.topProductivity.name} (${summary.topProductivity.scores?.productivity ?? 0})`);
  if (summary.bottomProductivity && summary.bottomProductivity.id !== summary.topProductivity?.id) {
    lines.push(`Lowest productivity: ${summary.bottomProductivity.name} (${summary.bottomProductivity.scores?.productivity ?? 0})`);
  }
  if (summary.idleWithWork.length > 0) {
    lines.push(`Idle with work waiting: ${summary.idleWithWork.map((c) => byId.get(c.agentId)?.name ?? c.agentId).join(", ")}`);
  }
  return lines.join("\n");
}

const PA_ISSUE_TITLE = "PA productivity reports";
const state = (companyId: string, stateKey: string) => ({ scopeKind: "company" as const, scopeId: companyId, stateKey });
const LAST_RUN_KEY = "pa-last-run";
const REPORT_ISSUE_KEY = "pa-report-issue-id";
const FLAGS_KEY = "pa-flags";

function topOfOrg(agents: OfficeAgent[]): OfficeAgent | undefined {
  return agents.find((a) => a.isChief) ?? agents[0];
}

async function reportIssueId(ctx: PluginContext, companyId: string, chiefId: string): Promise<string> {
  const cached = (await ctx.state.get(state(companyId, REPORT_ISSUE_KEY))) as string | null;
  if (cached) return cached;
  const issue = await ctx.issues.create({ companyId, title: PA_ISSUE_TITLE, description: "Recurring PA check-in summaries. One comment per check.", assigneeAgentId: chiefId, status: "backlog" });
  await ctx.state.set(state(companyId, REPORT_ISSUE_KEY), issue.id);
  return issue.id;
}

/** Runs a PA check if `paIntervalMinutes` has elapsed since the last one; deterministic, zero LLM tokens. */
export async function maybeRunPaCheck(
  ctx: PluginContext,
  companyId: string,
  agents: OfficeAgent[],
  paEnabled: boolean,
  paReports: boolean,
  intervalMinutes: number,
  now: Date,
): Promise<Map<string, { flag: string | null; lastCheckedAt: string | null }>> {
  const priorFlagsRaw = (await ctx.state.get(state(companyId, FLAGS_KEY)).catch(() => null)) as Record<string, { flag: string | null; lastCheckedAt: string | null }> | null;
  const priorFlags = new Map(Object.entries(priorFlagsRaw ?? {}));
  if (!paEnabled || agents.length === 0) return priorFlags;

  const lastRun = (await ctx.state.get(state(companyId, LAST_RUN_KEY)).catch(() => null)) as string | null;
  if (lastRun && now.getTime() - Date.parse(lastRun) < intervalMinutes * 60_000) return priorFlags;

  const checks = buildPaChecks(agents, now);
  const nowIso = now.toISOString();
  const nextFlags = new Map<string, { flag: string | null; lastCheckedAt: string | null }>();
  for (const c of checks) nextFlags.set(c.agentId, { flag: c.flag, lastCheckedAt: nowIso });
  await ctx.state.set(state(companyId, FLAGS_KEY), Object.fromEntries(nextFlags));
  await ctx.state.set(state(companyId, LAST_RUN_KEY), nowIso);

  if (paReports) {
    const chief = topOfOrg(agents);
    if (chief) {
      try {
        const issueId = await reportIssueId(ctx, companyId, chief.id);
        const summary = summarizePaChecks(checks, agents);
        const byId = new Map(agents.map((a) => [a.id, a]));
        await ctx.issues.createComment(issueId, formatPaReport(summary, byId), companyId);
      } catch (err) {
        ctx.logger.warn("office: PA report failed", { error: String(err).slice(0, 200) });
      }
    }
  }
  return nextFlags;
}

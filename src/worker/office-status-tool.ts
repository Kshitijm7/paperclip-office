import type { PluginContext, ToolResult } from "@paperclipai/plugin-sdk";
import { buildOffice, type AgentRow, type IssueRow, type OfficeAgent, type OfficeState, type RunRow } from "../shared/office.js";
import type { OfficeSettings } from "../shared/settings.js";

const OPEN_STATUSES = new Set(["todo", "in_progress", "in_review", "blocked"]);
const STATES: OfficeState[] = ["idle", "thinking", "working", "blocked"];

export interface OfficeStatusAgentSummary {
  id: string;
  name: string;
  title: string | null;
  department: string;
  state: OfficeState;
  issue: { label: string; title: string } | null;
}

export interface OfficeStatusResult {
  counts: Record<OfficeState, number>;
  idle: OfficeStatusAgentSummary[];
  stuck: Array<OfficeStatusAgentSummary & { reason: string }>;
  overloaded: Array<OfficeStatusAgentSummary & { openIssues: number }>;
  text: string;
}

export interface OfficeStatusFilter {
  department?: string;
  state?: OfficeState;
}

function summarize(a: OfficeAgent): OfficeStatusAgentSummary {
  return {
    id: a.id,
    name: a.name,
    title: a.title,
    department: a.department,
    state: a.state,
    issue: a.issue ? { label: a.issue.label, title: a.issue.title } : null,
  };
}

/** Pure: counts + idle/stuck/overloaded lists for the agent tool and any future UI reuse. */
export function buildOfficeStatus(
  agents: OfficeAgent[],
  issues: IssueRow[],
  filter: OfficeStatusFilter,
  overloadThreshold: number,
): OfficeStatusResult {
  const scoped = agents.filter(
    (a) => (!filter.department || a.department === filter.department) && (!filter.state || a.state === filter.state),
  );

  const counts = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<OfficeState, number>;
  for (const a of scoped) counts[a.state]++;

  const openByAgent = new Map<string, number>();
  for (const i of issues) {
    if (!i.assigneeAgentId || !OPEN_STATUSES.has(i.status)) continue;
    openByAgent.set(i.assigneeAgentId, (openByAgent.get(i.assigneeAgentId) ?? 0) + 1);
  }

  const idle = scoped.filter((a) => a.state === "idle").map(summarize);
  const stuck = scoped.filter((a) => a.stuck).map((a) => ({ ...summarize(a), reason: a.stuckReason ?? "stuck" }));
  const overloaded = scoped
    .filter((a) => (openByAgent.get(a.id) ?? 0) >= overloadThreshold)
    .map((a) => ({ ...summarize(a), openIssues: openByAgent.get(a.id) ?? 0 }));

  const text = [
    `${scoped.length} agents: ${counts.working} working, ${counts.thinking} thinking, ${counts.blocked} blocked, ${counts.idle} idle.`,
    stuck.length ? `Stuck: ${stuck.map((a) => `${a.name} (${a.reason})`).join(", ")}.` : null,
    overloaded.length ? `Overloaded: ${overloaded.map((a) => `${a.name} (${a.openIssues} open)`).join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return { counts, idle, stuck, overloaded, text };
}

export interface OfficeSnapshotLoader {
  (companyId: string): Promise<{ agentRows: AgentRow[]; issueRows: IssueRow[]; runs: RunRow[]; minutes: number; settings: OfficeSettings }>;
}

/** Declared statically in the manifest, so a disabled setting is enforced here rather than by omitting registration. */
export function registerOfficeStatusTool(ctx: PluginContext, loadSnapshot: OfficeSnapshotLoader): void {
  ctx.tools.register(
    "office_status",
    {
      displayName: "Office status",
      description: "Who is idle, stuck, or overloaded right now, optionally filtered by department or state.",
      parametersSchema: {
        type: "object",
        properties: {
          department: { type: "string", description: "Restrict to one department name." },
          state: { type: "string", enum: STATES, description: "Restrict to one state." },
        },
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const { agentRows, issueRows, runs, minutes, settings } = await loadSnapshot(runCtx.companyId);
      if (!settings.officeStatusTool) {
        return { content: "The office status tool is disabled for this company." };
      }
      const p = (params ?? {}) as OfficeStatusFilter;
      const office = buildOffice(agentRows, runs, issueRows, new Date(), minutes, settings);
      const result = buildOfficeStatus(office.agents, issueRows, p, settings.overloadThreshold);
      return { content: result.text, data: result };
    },
  );
}

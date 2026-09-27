import type { AgentRow, IssueRow } from "../shared/office.js";
import { buildDepartments } from "../shared/org.js";

export const RECOGNITION_CONFIG = {
  weekDays: 7,
  monthDays: 30,
  scoreWeights: { closed: 3, succeeded: 1, failed: -1 },
  minRunsForReliable: 5,
  leaderboardSize: 5,
} as const;

export interface RunEvent {
  agentId: string;
  status: string;
  createdAt: string;
}

export interface AgentStats {
  agentId: string;
  name: string;
  department: string;
  closed: number;
  succeeded: number;
  failed: number;
  /** No persisted handoff log exists yet (see CLAUDE.md's planned office_events); always 0 until one lands. */
  handoffsSent: number;
  score: number;
}

export interface RecognitionData {
  generatedAt: string;
  employeeOfWeek: AgentStats | null;
  employeeOfMonth: AgentStats | null;
  leaderboard: AgentStats[];
  mostReliable: { agentId: string; name: string; successRate: number; runs: number } | null;
  byDepartment: AgentStats[];
}

function statsForWindow(
  agents: AgentRow[],
  issues: IssueRow[],
  runs: RunEvent[],
  now: Date,
  days: number,
  deptByAgent: Map<string, string>,
): AgentStats[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60_000;
  const closedByAgent = new Map<string, number>();
  for (const issue of issues) {
    if (issue.status !== "done" || !issue.assigneeAgentId || !issue.updatedAt) continue;
    if (Date.parse(issue.updatedAt) <= cutoff) continue;
    closedByAgent.set(issue.assigneeAgentId, (closedByAgent.get(issue.assigneeAgentId) ?? 0) + 1);
  }
  const succeeded = new Map<string, number>();
  const failed = new Map<string, number>();
  for (const run of runs) {
    if (Date.parse(run.createdAt) <= cutoff) continue;
    if (run.status === "succeeded") succeeded.set(run.agentId, (succeeded.get(run.agentId) ?? 0) + 1);
    else if (run.status === "failed") failed.set(run.agentId, (failed.get(run.agentId) ?? 0) + 1);
  }
  const { scoreWeights: w } = RECOGNITION_CONFIG;
  return agents
    .map((a): AgentStats => {
      const closed = closedByAgent.get(a.id) ?? 0;
      const succ = succeeded.get(a.id) ?? 0;
      const fail = failed.get(a.id) ?? 0;
      return {
        agentId: a.id,
        name: a.name,
        department: deptByAgent.get(a.id) ?? "Staff",
        closed,
        succeeded: succ,
        failed: fail,
        handoffsSent: 0,
        score: closed * w.closed + succ * w.succeeded + fail * w.failed,
      };
    })
    .sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId));
}

/** Pure: recognition stats derived from a company snapshot (agents, issues, and recent run events). */
export function computeRecognition(agents: AgentRow[], issues: IssueRow[], runs: RunEvent[], now: Date): RecognitionData {
  const deptByAgent = new Map<string, string>();
  for (const d of buildDepartments(agents)) for (const id of d.agentIds) deptByAgent.set(id, d.name);

  const week = statsForWindow(agents, issues, runs, now, RECOGNITION_CONFIG.weekDays, deptByAgent);
  const month = statsForWindow(agents, issues, runs, now, RECOGNITION_CONFIG.monthDays, deptByAgent);

  const reliable = month
    .filter((a) => a.succeeded + a.failed >= RECOGNITION_CONFIG.minRunsForReliable)
    .map((a) => ({ agentId: a.agentId, name: a.name, successRate: a.succeeded / (a.succeeded + a.failed), runs: a.succeeded + a.failed }))
    .sort((a, b) => b.successRate - a.successRate || a.agentId.localeCompare(b.agentId));

  const byDepartment: AgentStats[] = [];
  const seenDept = new Set<string>();
  for (const stat of month) {
    if (seenDept.has(stat.department)) continue;
    seenDept.add(stat.department);
    byDepartment.push(stat);
  }

  return {
    generatedAt: now.toISOString(),
    employeeOfWeek: week[0] ?? null,
    employeeOfMonth: month[0] ?? null,
    leaderboard: month.slice(0, RECOGNITION_CONFIG.leaderboardSize),
    mostReliable: reliable[0] ?? null,
    byDepartment,
  };
}

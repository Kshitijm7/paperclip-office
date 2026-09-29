import type { AgentRow, IssueRow } from "./office.js";
import { buildDepartments, buildOrg } from "./org.js";

export const LEVEL_CONFIG = {
  /** Top fraction (by closed-issue count) of a department's leaf agents that qualify as Senior. */
  seniorQuartile: 0.25,
  numeric: { Chief: 5, Director: 4, Lead: 3, Senior: 2, Member: 1 } as const,
} as const;

export type LevelName = keyof typeof LEVEL_CONFIG.numeric;

export interface AgentLevel {
  level: number;
  levelName: LevelName;
  reportsCount: number;
}

/** Seniority from org shape (depth/span) plus, for leaves, closed-issue standing within their department. */
export function computeLevels(agents: AgentRow[], issues: IssueRow[]): Map<string, AgentLevel> {
  const { roots, nodesById } = buildOrg(agents);
  const chiefId = agents.find((a) => !a.reportsTo)?.id ?? null;
  const departments = buildDepartments(agents);

  const closedCount = new Map<string, number>();
  for (const issue of issues) {
    if (issue.status !== "done" || !issue.assigneeAgentId) continue;
    closedCount.set(issue.assigneeAgentId, (closedCount.get(issue.assigneeAgentId) ?? 0) + 1);
  }

  const seniorIds = new Set<string>();
  for (const dept of departments) {
    const leaves = dept.agentIds.filter((id) => (nodesById.get(id)?.children.length ?? 0) === 0 && id !== chiefId);
    const ranked = [...leaves].sort((a, b) => (closedCount.get(b) ?? 0) - (closedCount.get(a) ?? 0));
    const topCount = Math.ceil(ranked.length * LEVEL_CONFIG.seniorQuartile);
    for (const id of ranked.slice(0, topCount)) {
      if ((closedCount.get(id) ?? 0) > 0) seniorIds.add(id);
    }
  }

  const out = new Map<string, AgentLevel>();
  function visit(node: ReturnType<typeof buildOrg>["roots"][number]) {
    const reportsCount = node.children.length;
    const isChief = node.id === chiefId;
    const managesLead = node.children.some((c) => c.children.length > 0);
    let levelName: LevelName;
    if (isChief) levelName = "Chief";
    else if (managesLead) levelName = "Director";
    else if (reportsCount > 0) levelName = "Lead";
    else if (seniorIds.has(node.id)) levelName = "Senior";
    else levelName = "Member";
    out.set(node.id, { level: LEVEL_CONFIG.numeric[levelName], levelName, reportsCount });
    for (const child of node.children) visit(child);
  }
  for (const root of roots) visit(root);

  return out;
}

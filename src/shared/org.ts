import type { AgentRow } from "./office.js";

export interface OrgNode {
  id: string;
  depth: number;
  chain: string[];
  children: OrgNode[];
  department: string;
}

export interface Department {
  name: string;
  agentIds: string[];
}

/** Builds the reportsTo tree. Cycles and dangling managers are treated as reporting to the chief (or as roots). */
export function buildOrg(agents: AgentRow[]): { roots: OrgNode[]; nodesById: Map<string, OrgNode> } {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const childrenOf = new Map<string, AgentRow[]>();
  const chiefId = agents.find((a) => !a.reportsTo)?.id ?? null;

  function managerOf(a: AgentRow): string | null {
    if (!a.reportsTo || !byId.has(a.reportsTo) || a.reportsTo === a.id) return null;
    return a.reportsTo;
  }

  for (const a of agents) {
    const mgr = managerOf(a);
    if (mgr === null) continue;
    if (!childrenOf.has(mgr)) childrenOf.set(mgr, []);
    childrenOf.get(mgr)!.push(a);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.id.localeCompare(b.id));

  const nodesById = new Map<string, OrgNode>();
  const visiting = new Set<string>();

  function build(a: AgentRow, depth: number, chain: string[], department: string): OrgNode {
    const node: OrgNode = { id: a.id, depth, chain, children: [], department };
    nodesById.set(a.id, node);
    if (visiting.has(a.id)) return node; // cycle guard
    visiting.add(a.id);
    const kids = (childrenOf.get(a.id) ?? []).filter((k) => !chain.includes(k.id) && k.id !== a.id);
    node.children = kids.map((k) => build(k, depth + 1, [...chain, a.id], department));
    visiting.delete(a.id);
    return node;
  }

  const rootAgents = agents
    .filter((a) => managerOf(a) === null)
    .sort((a, b) => a.id.localeCompare(b.id));

  // Agents whose manager chain never reaches a real root (a pure cycle) would otherwise vanish; seat them as roots too.
  const reachable = new Set<string>();
  function markReachable(id: string) {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const c of childrenOf.get(id) ?? []) markReachable(c.id);
  }
  for (const a of rootAgents) markReachable(a.id);
  const cycleRoots = agents
    .filter((a) => !reachable.has(a.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const allRootAgents = [...rootAgents, ...cycleRoots].filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));

  const roots = allRootAgents.map((a) => {
    const isChief = a.id === chiefId;
    const dept = isChief ? "Chief" : (a.title ?? a.name);
    return build(a, 0, [], dept);
  });

  return { roots, nodesById };
}

/** Departments = each direct report of the Chief plus their whole subtree; chief-direct agents with no reports go to "Staff". */
export function buildDepartments(agents: AgentRow[]): Department[] {
  const { roots, nodesById } = buildOrg(agents);
  const chiefId = agents.find((a) => !a.reportsTo)?.id ?? null;
  const chief = roots.find((r) => r.id === chiefId);
  const departments: Department[] = [];
  if (!chief) {
    // No chief found (e.g. empty or fully cyclic input): treat every root as its own department.
    for (const r of roots) departments.push({ name: r.department, agentIds: collect(r) });
    return departments;
  }
  departments.push({ name: "Chief", agentIds: [chief.id] });
  const staff: string[] = [];
  for (const child of chief.children) {
    if (child.children.length === 0) {
      staff.push(child.id);
    } else {
      const a = agents.find((x) => x.id === child.id);
      departments.push({ name: a?.title ?? a?.name ?? child.id, agentIds: collect(child) });
    }
  }
  if (staff.length > 0) departments.push({ name: "Staff", agentIds: staff });
  return departments;

  function collect(node: ReturnType<typeof buildOrg>["roots"][number]): string[] {
    const out: string[] = [node.id];
    for (const c of node.children) out.push(...collect(c));
    return out;
  }
  void nodesById;
}

/** Agent ids in DFS order, grouped by department (chief first), deterministic for stable seating. */
export function deptOrder(agents: AgentRow[]): string[] {
  const depts = buildDepartments(agents);
  return depts.flatMap((d) => d.agentIds);
}

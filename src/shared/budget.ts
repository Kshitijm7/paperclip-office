export interface BudgetIncidentRow {
  id: string;
  scopeType: string;
  scopeId: string;
  scopeName: string;
  metric: string;
  amountLimit: number;
  amountObserved: number;
  status: string;
}

export function openBudgetIncidents(rows: BudgetIncidentRow[]): BudgetIncidentRow[] {
  return rows.filter((r) => r.status === "open");
}

/** Agent ids with an open incident scoped directly to them (a company- or project-scoped incident does not mark an agent). */
export function overBudgetAgentIds(openIncidents: BudgetIncidentRow[]): Set<string> {
  return new Set(openIncidents.filter((i) => i.scopeType === "agent").map((i) => i.scopeId));
}

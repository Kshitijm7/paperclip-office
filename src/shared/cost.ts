export interface CostEventRow {
  agentId: string;
  costCents: number;
  occurredAt: string;
}

export interface AgentCost {
  costCents: number;
  costTodayCents: number;
}

function isSameUtcDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

/** Sums cost per agent over the whole given window, plus a same-UTC-day-as-now subtotal. */
export function aggregateCostByAgent(events: CostEventRow[], now: Date): Map<string, AgentCost> {
  const out = new Map<string, AgentCost>();
  for (const e of events) {
    const cur = out.get(e.agentId) ?? { costCents: 0, costTodayCents: 0 };
    cur.costCents += e.costCents;
    if (isSameUtcDay(e.occurredAt, now)) cur.costTodayCents += e.costCents;
    out.set(e.agentId, cur);
  }
  return out;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

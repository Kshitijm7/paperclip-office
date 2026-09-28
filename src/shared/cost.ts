export interface CostEventRow {
  agentId: string;
  costCents: number;
  tokens: number;
  occurredAt: string;
}

export interface AgentCost {
  costCents: number;
  costTodayCents: number;
  tokens: number;
  tokensToday: number;
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
    const cur = out.get(e.agentId) ?? { costCents: 0, costTodayCents: 0, tokens: 0, tokensToday: 0 };
    cur.costCents += e.costCents;
    cur.tokens += e.tokens;
    if (isSameUtcDay(e.occurredAt, now)) {
      cur.costTodayCents += e.costCents;
      cur.tokensToday += e.tokens;
    }
    out.set(e.agentId, cur);
  }
  return out;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export type CostMetric = "auto" | "dollars" | "tokens";

function formatTokens(tokens: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(tokens) + " tok";
}

/** Subscription runs record 0 cents, so "auto" falls back to tokens when there is no dollar spend. */
export function formatSpend(cents: number, tokens: number, metric: CostMetric): string {
  if (metric === "tokens" || (metric === "auto" && cents === 0 && tokens > 0)) return formatTokens(tokens);
  return formatCents(cents);
}

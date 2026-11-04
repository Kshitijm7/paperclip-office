import type { PluginContext } from "@paperclipai/plugin-sdk";
import { diffHandoffs, type Handoff, type HandoffKind, type IssueRow } from "../shared/office.js";

/**
 * The office event log: `office_events` in the plugin's own database namespace
 * (migrations/0001_office_events.sql, 0002 adds handoff_kind). Handoffs are the first kind of event.
 */
export const HANDOFF_EVENT = "handoff";
/** How far back the office data serves envelopes. */
export const HANDOFF_SERVE_MS = 10 * 60_000;
/** The most envelopes one office poll returns; over it, the newest are kept. */
export const HANDOFF_READ_LIMIT = 500;
/** The most logged handoffs the Wall of Fame reads to count handoffs sent; over it, the newest are kept. */
export const HANDOFF_COUNT_LIMIT = 5000;
/** How long the log keeps any event. Older rows are deleted. */
export const EVENT_RETENTION_MS = 24 * 60 * 60_000;
/** How often pruning runs at most, so a row can outlive the retention by up to this much. */
export const PRUNE_EVERY_MS = 10 * 60_000;

type Db = Pick<PluginContext["db"], "namespace" | "query" | "execute">;
type Logger = Pick<PluginContext["logger"], "warn" | "info">;

function table(db: Db): string {
  return `${db.namespace}.office_events`;
}

const HANDOFF_KINDS = new Set<string>(["reassign", "delegate", "return"] satisfies HandoffKind[]);
const INSERT_COLUMNS = ["company_id", "kind", "occurred_at", "from_agent_id", "to_agent_id", "issue_id", "issue_label", "handoff_kind"];

function iso(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

/**
 * Remembers each company's last issue snapshot and diffs the next one against it, using diffHandoffs.
 * Polls can overlap (the page and the widget both poll), so a snapshot that started loading before the
 * current baseline is dropped: diffing an older snapshot against a newer one would invent a reverse handoff,
 * and once handoffs are persisted that phantom would stay in the log.
 */
export class HandoffTracker {
  private seq = 0;
  private readonly last = new Map<string, { seq: number; issues: IssueRow[] }>();

  /** Call before loading the snapshot; pass the ticket to `observe` once it has loaded. */
  begin(): number {
    return ++this.seq;
  }

  observe(companyId: string, ticket: number, issues: IssueRow[], now: Date): Handoff[] {
    const prior = this.last.get(companyId);
    if (prior && ticket <= prior.seq) return [];
    this.last.set(companyId, { seq: ticket, issues });
    return diffHandoffs(prior?.issues, issues, now);
  }
}

/** Appends handoffs to the log, one row each, in one statement. Throws on a database error. */
export async function recordHandoffs(db: Db, companyId: string, handoffs: Handoff[]): Promise<void> {
  if (handoffs.length === 0) return;
  const params: unknown[] = [];
  const rows = handoffs.map((h) => {
    const base = params.length;
    params.push(companyId, HANDOFF_EVENT, h.at, h.from, h.to, h.issueId ?? null, h.issue, h.kind ?? null);
    return `(${INSERT_COLUMNS.map((_, i) => `$${base + i + 1}`).join(", ")})`;
  });
  await db.execute(
    `INSERT INTO ${table(db)} (${INSERT_COLUMNS.join(", ")})
     VALUES ${rows.join(", ")}`,
    params,
  );
}

/** Handoffs that occurred after `since`, oldest first (the order the office has always sent). Throws on a database error. */
export async function readHandoffsSince(db: Db, companyId: string, since: Date, limit = HANDOFF_READ_LIMIT): Promise<Handoff[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT id, occurred_at, from_agent_id, to_agent_id, issue_id, issue_label, handoff_kind
       FROM ${table(db)}
      WHERE company_id = $1 AND kind = $2 AND occurred_at > $3
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${Math.max(1, Math.floor(limit))}`,
    [companyId, HANDOFF_EVENT, since.toISOString()],
  );
  return rows.reverse().map((r) => ({
    ...(HANDOFF_KINDS.has(String(r.handoff_kind)) ? { kind: r.handoff_kind as HandoffKind } : {}),
    from: String(r.from_agent_id),
    to: String(r.to_agent_id),
    issue: String(r.issue_label),
    ...(r.issue_id != null ? { issueId: String(r.issue_id) } : {}),
    at: iso(r.occurred_at),
  }));
}

/**
 * Handoffs since `since`, for counting who sent what (the Wall of Fame's handoffsSent). Reads at most `limit` rows,
 * newest first, and warns when it hits the limit because older handoffs then go uncounted. Throws on a database error.
 */
export async function loadHandoffsSent(
  db: Db,
  logger: Logger,
  companyId: string,
  since: Date,
  limit = HANDOFF_COUNT_LIMIT,
): Promise<Handoff[]> {
  const handoffs = await readHandoffsSince(db, companyId, since, limit);
  if (handoffs.length >= limit) logger.warn("office: handoff counts truncated", { companyId, limit, oldestCounted: handoffs[0]?.at });
  return handoffs;
}

/** Deletes every event (all kinds, all companies) that occurred before `before`. Throws on a database error. */
export async function pruneEvents(db: Db, before: Date): Promise<number> {
  const { rowCount } = await db.execute(`DELETE FROM ${table(db)} WHERE occurred_at < $1`, [before.toISOString()]);
  return rowCount;
}

/**
 * Keeps the log to EVENT_RETENTION_MS. Runs at most once per PRUNE_EVERY_MS however often it is asked,
 * so the office poll and the worker timer can both ask. Never throws: a failed prune is logged and retried next interval.
 */
export class EventPruner {
  private lastRunAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly everyMs = PRUNE_EVERY_MS,
    private readonly retentionMs = EVENT_RETENTION_MS,
  ) {}

  /** Rows deleted, or null when skipped (too soon) or failed. */
  async maybePrune(db: Db, logger: Logger, now: Date): Promise<number | null> {
    if (now.getTime() - this.lastRunAt < this.everyMs) return null;
    this.lastRunAt = now.getTime();
    try {
      const deleted = await pruneEvents(db, new Date(now.getTime() - this.retentionMs));
      if (deleted > 0) logger.info("office: pruned old office events", { deleted });
      return deleted;
    } catch (err) {
      logger.warn("office: office event prune failed", { error: String(err).slice(0, 200) });
      return null;
    }
  }
}

/**
 * The office data handler's handoff step: diff the snapshot, log new handoffs, prune, and read back the window.
 * A failed write or read rejects, and the handler treats handoffs like its other optional data (warn, serve none).
 * A failed prune doesn't: it is maintenance, logged by EventPruner, and the timer retries it.
 */
export class HandoffLog {
  readonly tracker = new HandoffTracker();
  readonly pruner = new EventPruner();

  /** Call before loading the snapshot. */
  begin(): number {
    return this.tracker.begin();
  }

  async serve(db: Db, logger: Logger, companyId: string, ticket: number, issues: IssueRow[], now: Date): Promise<Handoff[]> {
    const fresh = this.tracker.observe(companyId, ticket, issues, now);
    await recordHandoffs(db, companyId, fresh);
    await this.pruner.maybePrune(db, logger, now);
    return readHandoffsSince(db, companyId, new Date(now.getTime() - HANDOFF_SERVE_MS));
  }
}

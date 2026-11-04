import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { diffHandoffs, toIssueRow, type Handoff, type IssueRow, type SdkIssueLike } from "../src/shared/office.js";
import {
  EVENT_RETENTION_MS,
  HANDOFF_COUNT_LIMIT,
  HANDOFF_SERVE_MS,
  HandoffLog,
  HandoffTracker,
  PRUNE_EVERY_MS,
  loadHandoffsSent,
  readHandoffsSince,
  recordHandoffs,
} from "../src/worker/office-events.js";
import manifest from "../src/manifest.js";
import type { RecognitionData } from "../src/worker/recognition.js";
import plugin from "../src/worker.js";

// ---- Fixture: recorded-shape polls (see tests/fixtures/README.md) ----

interface Poll {
  polledAt: string;
  companyId: string;
  note: string;
  issues: SdkIssueLike[];
}

function loadPolls(name: string): Poll[] {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Poll);
}

const POLLS = loadPolls("handoff-polls.jsonl");
const WIDE_POLLS = loadPolls("handoff-delegate-return-polls.jsonl");

const CO = POLLS[0].companyId;
const LEAD = "1b7e4c2a-5d90-4e3f-a8b6-7c2d1e9f0a31";
const ADA = "2c8f5d3b-6ea1-4f40-b9c7-8d3e2fa01b42";
const BO = "3d906e4c-7fb2-4051-8ad8-9e4f30b12c53";
const CY = "4ea17f5d-80c3-4162-9be9-af5041c23d64";
const NWR_101 = "7a11c0de-1e2f-4a3b-9c4d-5e6f7a8b9c01";
const NWR_104 = "7a41c0de-4e2f-4a3b-9c4d-5e6f7a8b9c04";

/** The envelopes each fixture poll must produce. */
const ADA_TO_BO: Handoff = { kind: "reassign", from: ADA, to: BO, issue: "NWR-101", issueId: NWR_101, at: "2026-10-01T09:00:04.000Z" };
const LEAD_TO_CY: Handoff = { kind: "delegate", from: LEAD, to: CY, issue: "NWR-104", issueId: NWR_104, at: "2026-10-01T09:00:04.000Z" };
const CY_TO_LEAD: Handoff = { kind: "reassign", from: CY, to: LEAD, issue: "NWR-104", issueId: NWR_104, at: "2026-10-01T09:00:12.000Z" };

// ---- An in-memory office_events table behind the ctx.db interface ----
// It applies the same filters the SQL does; the SQL itself was checked against PostgreSQL 16 separately.

interface Row {
  id: number;
  [column: string]: unknown;
}

function memoryDb(namespace = "plugin_paperclip_office_office") {
  const rows: Row[] = [];
  const statements: string[] = [];
  /** The parameters of each query(), in order. */
  const queryParams: unknown[][] = [];
  let nextId = 1;
  const db = {
    namespace,
    rows,
    statements,
    queryParams,
    failWrites: false,
    failReads: false,
    failPrunes: false,
    async execute(sql: string, params: unknown[] = []) {
      statements.push(sql);
      const prune = /^DELETE FROM (\S+) WHERE occurred_at < \$1$/.exec(sql.trim());
      if (prune) {
        if (db.failPrunes) throw new Error("canceling statement due to lock timeout");
        if (prune[1] !== `${namespace}.office_events`) throw new Error(`unexpected statement: ${sql}`);
        const before = Date.parse(String(params[0]));
        const keep = rows.filter((r) => Date.parse(String(r.occurred_at)) >= before);
        const deleted = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return { rowCount: deleted };
      }
      if (db.failWrites) throw new Error("capability database.namespace.write is not granted");
      const m = /^INSERT INTO (\S+) \(([^)]+)\)\s+VALUES/.exec(sql.trim());
      if (!m || m[1] !== `${namespace}.office_events`) throw new Error(`unexpected statement: ${sql}`);
      const cols = m[2].split(",").map((c) => c.trim());
      for (let i = 0; i < params.length; i += cols.length) {
        rows.push({ id: nextId++, ...Object.fromEntries(cols.map((c, j) => [c, params[i + j]])) });
      }
      return { rowCount: params.length / cols.length };
    },
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      statements.push(sql);
      queryParams.push(params);
      if (db.failReads) throw new Error('relation "office_events" does not exist');
      if (!sql.includes(`FROM ${namespace}.office_events`)) throw new Error(`unexpected query: ${sql}`);
      const [companyId, kind, since] = params as [string, string, string];
      const limit = Number(/LIMIT (\d+)/.exec(sql)?.[1]);
      return rows
        .filter((r) => r.company_id === companyId && r.kind === kind && Date.parse(String(r.occurred_at)) > Date.parse(since))
        .sort((a, b) => Date.parse(String(b.occurred_at)) - Date.parse(String(a.occurred_at)) || b.id - a.id)
        .slice(0, limit)
        // The pg driver hands timestamptz back as a Date.
        .map((r) => ({ ...r, occurred_at: new Date(String(r.occurred_at)) }) as T);
    },
  };
  return db;
}

function quietLogger() {
  return { warn: vi.fn(), info: vi.fn() };
}

/** The office data handler's handoff step for one poll: the same HandoffLog.serve the worker calls. */
async function poll(log: HandoffLog, db: ReturnType<typeof memoryDb>, logger: ReturnType<typeof quietLogger>, p: Poll) {
  return log.serve(db, logger, p.companyId, log.begin(), p.issues.map(toIssueRow), new Date(p.polledAt));
}

describe("office_events handoff log, replaying recorded polls", () => {
  it("records each handoff diffHandoffs finds and serves the last 10 minutes from the log", async () => {
    const db = memoryDb();
    const logger = quietLogger();
    const log = new HandoffLog();
    const shown: Handoff[][] = [];
    for (const p of POLLS) shown.push(await poll(log, db, logger, p));

    expect(shown).toEqual([
      [], // baseline after a worker start
      [ADA_TO_BO, LEAD_TO_CY], // reassignment and child issue; pickup from nobody and a status change are not handoffs
      [ADA_TO_BO, LEAD_TO_CY], // nothing new, still within 60s
      [ADA_TO_BO, LEAD_TO_CY, CY_TO_LEAD], // second reassignment; assignment from nobody, unlisted parent are not handoffs
      [CY_TO_LEAD], // poll 2's envelopes are 10m03s old, poll 4's 9m55s
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
    // Each handoff is written exactly once, even though it is served on several polls.
    expect(db.rows.map((r) => ({ ...r, id: undefined }))).toEqual([
      { id: undefined, company_id: CO, kind: "handoff", occurred_at: ADA_TO_BO.at, from_agent_id: ADA, to_agent_id: BO, issue_id: NWR_101, issue_label: "NWR-101", handoff_kind: "reassign" },
      { id: undefined, company_id: CO, kind: "handoff", occurred_at: LEAD_TO_CY.at, from_agent_id: LEAD, to_agent_id: CY, issue_id: NWR_104, issue_label: "NWR-104", handoff_kind: "delegate" },
      { id: undefined, company_id: CO, kind: "handoff", occurred_at: CY_TO_LEAD.at, from_agent_id: CY, to_agent_id: LEAD, issue_id: NWR_104, issue_label: "NWR-104", handoff_kind: "reassign" },
    ]);
    // Polls with nothing new issue no INSERT.
    expect(db.statements.filter((s) => s.trim().startsWith("INSERT"))).toHaveLength(2);
  });

  it("keeps handoffs across a worker restart", async () => {
    const db = memoryDb();
    const logger = quietLogger();
    const before = new HandoffLog();
    await poll(before, db, logger, POLLS[0]);
    await poll(before, db, logger, POLLS[1]);

    // A new worker process: fresh memory, same database.
    const after = new HandoffLog();
    expect(await poll(after, db, logger, POLLS[2])).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(await poll(after, db, logger, POLLS[3])).toEqual([ADA_TO_BO, LEAD_TO_CY, CY_TO_LEAD]);
  });

  it("keeps companies apart", async () => {
    const db = memoryDb();
    const logger = quietLogger();
    const log = new HandoffLog();
    for (const p of POLLS.slice(0, 2)) await poll(log, db, logger, p);
    const other = { ...POLLS[2], companyId: "another-company" };
    expect(await poll(log, db, logger, other)).toEqual([]);
  });
});

describe("delegate and return envelopes, replaying recorded polls", () => {
  const issueId = (n: number) => `7b${String(n).padStart(2, "0")}c0de-${String(n).padStart(4, "0")}-4a3b-9c4d-5e6f7a8b9d${String(n).padStart(2, "0")}`;
  const env = (kind: Handoff["kind"], from: string, to: string, n: number, at: string): Handoff => ({
    kind, from, to, issue: `NWR-${200 + n}`, issueId: issueId(n), at: `2026-10-01T09:10:${at}.000Z`,
  });
  const DELEGATE_202 = env("delegate", LEAD, BO, 2, "04");
  const RETURN_203 = env("return", ADA, LEAD, 3, "08");
  const REASSIGN_202 = env("reassign", BO, CY, 2, "12");
  const RETURN_202 = env("return", CY, LEAD, 2, "12");
  const RETURN_207 = env("return", CY, LEAD, 7, "16");
  const RETURN_203_AGAIN = env("return", ADA, LEAD, 3, "24");

  it("finds exactly the envelopes each poll's note describes", () => {
    const tracker = new HandoffTracker();
    const found = WIDE_POLLS.map((p) => tracker.observe(p.companyId, tracker.begin(), p.issues.map(toIssueRow), new Date(p.polledAt)));
    expect(found).toEqual([
      [], // baseline
      [DELEGATE_202], // unassigned child assigned later; no envelope for top-level pickup, unassigned parent, self-delegation
      [RETURN_203], // child done; none for same assignee, unassigned parent, unlisted parent, status change
      [REASSIGN_202, RETURN_202], // reassigned and done in one poll: assignment first
      [RETURN_207], // parent's assignee comes from the same poll
      [], // reopened
      [RETURN_203_AGAIN], // done a second time; none for a child done and unassigned at once
    ]);
  });

  it("logs each envelope once with its kind and serves them all back in order", async () => {
    const db = memoryDb();
    const logger = quietLogger();
    const log = new HandoffLog();
    let shown: Handoff[] = [];
    for (const p of WIDE_POLLS) shown = await poll(log, db, logger, p);
    const all = [DELEGATE_202, RETURN_203, REASSIGN_202, RETURN_202, RETURN_207, RETURN_203_AGAIN];
    expect(shown).toEqual(all); // the last poll is 24s after the first envelope, so nothing has aged out
    expect(db.rows.map((r) => r.handoff_kind)).toEqual(all.map((h) => h.kind));
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("diffHandoffs edge cases", () => {
  const row = (id: string, assigneeAgentId: string | null, extra: Partial<IssueRow> = {}): IssueRow => ({
    id, identifier: id.toUpperCase(), title: id, status: "todo", assigneeAgentId, parentId: null, updatedAt: null, ...extra,
  });
  const now = new Date("2026-10-01T10:00:00Z");
  const parent = row("p", LEAD, { status: "in_progress" });
  const found = (prev: IssueRow[], next: IssueRow[]) => diffHandoffs(prev, next, now).map((h) => `${h.kind} ${h.from}>${h.to} ${h.issue}`);

  it("counts a child assigned again after being unassigned as a delegate from the parent's assignee", () => {
    const unassigned = row("c", null, { parentId: "p" });
    expect(found([parent, unassigned], [parent, { ...unassigned, assigneeAgentId: ADA }])).toEqual([`delegate ${LEAD}>${ADA} C`]);
  });

  it("sends no return for a child first seen already done: only its delegation", () => {
    expect(found([parent], [parent, row("c", ADA, { parentId: "p", status: "done" })])).toEqual([`delegate ${LEAD}>${ADA} C`]);
  });

  it("sends a return for a child moving to done from any status, including cancelled", () => {
    const child = row("c", ADA, { parentId: "p", status: "cancelled" });
    expect(found([parent, child], [parent, { ...child, status: "done" }])).toEqual([`return ${ADA}>${LEAD} C`]);
  });

  it("sends nothing when a top-level issue moves to done", () => {
    const solo = row("s", ADA, { status: "in_review" });
    expect(found([solo], [{ ...solo, status: "done" }])).toEqual([]);
  });
});

describe("HandoffTracker", () => {
  const [p1, p2] = POLLS.map((p) => p.issues.map(toIssueRow));
  const t = (p: Poll) => new Date(p.polledAt);

  it("drops a snapshot that finishes after a newer one, instead of inventing a reverse handoff", () => {
    const tracker = new HandoffTracker();
    tracker.observe(CO, tracker.begin(), p1, t(POLLS[0]));
    const slow = tracker.begin(); // starts loading first, gets the older data
    const quick = tracker.begin(); // starts later, finishes first with the newer data
    expect(tracker.observe(CO, quick, p2, t(POLLS[1])).map((h) => `${h.from}>${h.to} ${h.issue}`)).toEqual([
      `${ADA}>${BO} NWR-101`,
      `${LEAD}>${CY} NWR-104`,
    ]);
    expect(tracker.observe(CO, slow, p1, t(POLLS[1]))).toEqual([]); // would be Bo>Ada without the guard
    expect(tracker.observe(CO, tracker.begin(), p2, t(POLLS[2]))).toEqual([]); // and Ada>Bo again here
  });

  it("tracks each company's baseline separately", () => {
    const tracker = new HandoffTracker();
    tracker.observe("x", tracker.begin(), p1, t(POLLS[0]));
    expect(tracker.observe("y", tracker.begin(), p2, t(POLLS[1]))).toEqual([]); // y's first poll is its baseline
    expect(tracker.observe("x", tracker.begin(), p2, t(POLLS[1]))).toHaveLength(2);
  });
});

describe("HandoffLog.serve leaves write and read failures to the handler", () => {
  const at = (p: Poll) => new Date(p.polledAt);
  const issues = (p: Poll) => p.issues.map(toIssueRow);

  it("rejects when the write fails", async () => {
    const db = memoryDb();
    const log = new HandoffLog();
    await log.serve(db, quietLogger(), CO, log.begin(), issues(POLLS[0]), at(POLLS[0]));
    db.failWrites = true;
    await expect(log.serve(db, quietLogger(), CO, log.begin(), issues(POLLS[1]), at(POLLS[1]))).rejects.toThrow("namespace.write");
  });

  it("rejects when the read fails", async () => {
    const db = memoryDb();
    db.failReads = true;
    const log = new HandoffLog();
    await expect(log.serve(db, quietLogger(), CO, log.begin(), issues(POLLS[0]), at(POLLS[0]))).rejects.toThrow("does not exist");
  });
});

describe("log reads and writes", () => {
  it("returns the newest rows when over the limit, still oldest first", async () => {
    const db = memoryDb();
    await recordHandoffs(db, CO, [ADA_TO_BO, LEAD_TO_CY, CY_TO_LEAD]);
    const got = await readHandoffsSince(db, CO, new Date(0), 2);
    expect(got).toEqual([LEAD_TO_CY, CY_TO_LEAD]);
  });

  it("reads rows written before handoff kinds existed as envelopes without a kind", async () => {
    const db = memoryDb();
    const { kind: _kind, ...legacy } = ADA_TO_BO;
    await recordHandoffs(db, CO, [legacy]);
    expect(db.rows[0].handoff_kind).toBeNull();
    expect(await readHandoffsSince(db, CO, new Date(0))).toEqual([legacy]);
  });

  it("stores a handoff with no issue id (an issue without identifier uses its title)", async () => {
    const db = memoryDb();
    const untitled: Handoff = { from: ADA, to: BO, issue: "Fix the login bug", at: "2026-10-01T09:00:04.000Z" };
    await recordHandoffs(db, CO, [untitled]);
    expect(db.rows[0].issue_id).toBeNull();
    expect(await readHandoffsSince(db, CO, new Date(0))).toEqual([untitled]);
  });
});

describe("schema, writer and manifest agree", () => {
  const migrationsDir = new URL("../migrations/", import.meta.url);
  const migrations = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(new URL(f, migrationsDir), "utf8"));
  const created = /CREATE TABLE IF NOT EXISTS office_events \(([\s\S]*?)\n\);/.exec(migrations[0])?.[1] ?? "";
  const columns = new Set([
    ...created.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean),
    ...migrations.flatMap((m) => [...m.matchAll(/ALTER TABLE office_events ADD COLUMN IF NOT EXISTS (\w+)/g)].map((x) => x[1])),
  ]);

  it("migrations are numbered in order and the first creates the table", () => {
    expect(readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()).toEqual([
      "0001_office_events.sql",
      "0002_office_events_handoff_kind.sql",
    ]);
    expect(columns).toContain("handoff_kind");
  });

  it("the writer and reader only use columns the migration creates", async () => {
    const db = memoryDb();
    await recordHandoffs(db, CO, [ADA_TO_BO]);
    await readHandoffsSince(db, CO, new Date(0));
    const [insert, select] = db.statements;
    const inserted = /\(([^)]+)\)\s+VALUES/.exec(insert)![1].split(",").map((c) => c.trim());
    const selected = /SELECT ([\s\S]+?)\s+FROM/.exec(select)![1].split(",").map((c) => c.trim());
    expect(columns.size).toBeGreaterThan(0);
    for (const c of [...inserted, ...selected]) expect(columns, c).toContain(c);
  });

  it("the manifest grants the worker the namespace and the runtime writes it makes", () => {
    expect(manifest.database?.migrationsDir).toBe("migrations");
    expect(manifest.capabilities).toEqual(
      expect.arrayContaining(["database.namespace.migrate", "database.namespace.read", "database.namespace.write"]),
    );
  });
});

describe("toIssueRow", () => {
  it("maps an SDK issue the way the worker always has", () => {
    const sdk = POLLS[1].issues[3];
    expect(toIssueRow(sdk)).toEqual({
      id: NWR_104,
      identifier: "NWR-104",
      title: "Invoice PDF export",
      status: "todo",
      assigneeAgentId: CY,
      parentId: "7a21c0de-2e2f-4a3b-9c4d-5e6f7a8b9c02",
      updatedAt: "2026-10-01T09:00:03.000Z",
      priority: "medium",
    });
    expect(toIssueRow({ id: "i", title: "t", status: "todo", updatedAt: new Date("2026-10-01T09:00:00Z") }).updatedAt).toBe(
      "2026-10-01T09:00:00.000Z",
    );
  });
});

describe("retention (24h) and serving window (10 minutes)", () => {
  const now = new Date("2026-10-02T12:00:00.000Z");
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const seeded = (msAgo: number, issue: string): Handoff => ({ kind: "reassign", from: ADA, to: BO, issue, issueId: `id-${issue}`, at: ago(msAgo) });
  const OLD_25H = seeded(25 * HOUR, "NWR-025");
  const OLD_11M = seeded(11 * MIN, "NWR-011");
  const NEW_5M = seeded(5 * MIN, "NWR-005");
  /** A poll that finds nothing new: the first poll of a fresh HandoffLog is its baseline. */
  const serve = (log: HandoffLog, db: ReturnType<typeof memoryDb>, logger: ReturnType<typeof quietLogger>, at = now) =>
    log.serve(db, logger, CO, log.begin(), POLLS[0].issues.map(toIssueRow), at);

  it("the windows are 10 minutes and 24 hours", () => {
    expect(HANDOFF_SERVE_MS).toBe(10 * MIN);
    expect(EVENT_RETENTION_MS).toBe(24 * HOUR);
  });

  it("prunes the 25h row, keeps the 11m row without serving it, and serves the 5m row", async () => {
    const db = memoryDb();
    const logger = quietLogger();
    await recordHandoffs(db, CO, [OLD_25H, OLD_11M, NEW_5M]);

    expect(await serve(new HandoffLog(), db, logger)).toEqual([NEW_5M]);
    expect(db.rows.map((r) => r.issue_label)).toEqual(["NWR-011", "NWR-005"]);
    expect(logger.info).toHaveBeenCalledWith("office: pruned old office events", { deleted: 1 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("serves up to 10 minutes back, not including the 10-minute mark", async () => {
    const db = memoryDb();
    const inside = seeded(10 * MIN - 1000, "INSIDE");
    await recordHandoffs(db, CO, [seeded(10 * MIN, "ON-THE-MARK"), inside]);
    expect(await serve(new HandoffLog(), db, quietLogger())).toEqual([inside]);
  });

  it("keeps a row 24h old to the millisecond and prunes one a second older", async () => {
    const db = memoryDb();
    await recordHandoffs(db, CO, [seeded(24 * HOUR + 1000, "OVER"), seeded(24 * HOUR, "EXACT"), seeded(23 * HOUR, "UNDER")]);
    await serve(new HandoffLog(), db, quietLogger());
    expect(db.rows.map((r) => r.issue_label)).toEqual(["EXACT", "UNDER"]);
  });

  it("prunes every company and every event kind, not just the polled company's handoffs", async () => {
    const db = memoryDb();
    await recordHandoffs(db, "another-company", [OLD_25H, NEW_5M]);
    db.rows.push({ id: 99, company_id: CO, kind: "state_change", occurred_at: ago(30 * HOUR) });
    await serve(new HandoffLog(), db, quietLogger());
    expect(db.rows.map((r) => [r.company_id, r.issue_label ?? r.kind])).toEqual([["another-company", "NWR-005"]]);
  });

  it("prunes at most once every 10 minutes however often the office polls", async () => {
    const db = memoryDb();
    const log = new HandoffLog();
    const logger = quietLogger();
    const deletes = () => db.statements.filter((s) => s.startsWith("DELETE")).length;
    await serve(log, db, logger);
    expect(deletes()).toBe(1);

    await recordHandoffs(db, CO, [OLD_25H]);
    await serve(log, db, logger, new Date(now.getTime() + PRUNE_EVERY_MS - 1000));
    expect(deletes()).toBe(1);
    expect(db.rows).toHaveLength(1); // outlives the retention until the next prune

    await serve(log, db, logger, new Date(now.getTime() + PRUNE_EVERY_MS));
    expect(deletes()).toBe(2);
    expect(db.rows).toHaveLength(0);
  });

  it("still serves the window when the prune fails, and logs it", async () => {
    const db = memoryDb();
    const logger = quietLogger();
    await recordHandoffs(db, CO, [OLD_25H, NEW_5M]);
    db.failPrunes = true;
    expect(await serve(new HandoffLog(), db, logger)).toEqual([NEW_5M]);
    expect(logger.warn).toHaveBeenCalledWith("office: office event prune failed", expect.objectContaining({ error: expect.any(String) }));
    expect(db.rows).toHaveLength(2);
  });
});

/** Which office_events statements the fake ctx.db throws on. Mutable, so a test can break and mend the table mid-run. */
interface OfficeEventsFault {
  reads?: boolean; // SELECT
  writes?: boolean; // INSERT and DELETE
  prunes?: boolean; // DELETE only
  /** Throw synchronously from ctx.db instead of returning a rejected promise. */
  sync?: boolean;
}

/**
 * The real plugin setup() on the SDK's in-memory host. Its ctx.db checks capabilities against the manifest and
 * returns nothing, so office_events statements are also applied to a memory table (or thrown on, per `fault`);
 * core-table reads return no rows. Pass `table` to start a new worker process on an existing database.
 */
async function startWorker(startAt: string, fault: OfficeEventsFault = {}, table?: ReturnType<typeof memoryDb>) {
  if (vi.isFakeTimers()) {
    // A restart: the previous worker process and its timers are gone; the clock carries on.
    vi.clearAllTimers();
    vi.setSystemTime(new Date(startAt));
  } else {
    vi.useFakeTimers({ now: new Date(startAt), toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
  }
  const harness = createTestHarness({ manifest });
  const host = harness.ctx.db;
  const mem = table ?? memoryDb(host.namespace);
  const ours = (sql: string) => sql.includes(`${host.namespace}.office_events`);
  const faultFor = (sql: string): Error | null => {
    if (!ours(sql)) return null;
    const verb = sql.trim().split(/\s+/)[0];
    const hit = verb === "SELECT" ? fault.reads : verb === "DELETE" ? fault.writes || fault.prunes : fault.writes;
    return hit ? new Error(`relation "${host.namespace}.office_events" does not exist`) : null;
  };
  const call = <T>(sql: string, run: () => Promise<T>): Promise<T> => {
    const err = faultFor(sql);
    if (err && fault.sync) throw err;
    return err ? Promise.reject(err) : run();
  };
  Object.assign(harness.ctx, {
    db: {
      namespace: host.namespace,
      query: (sql: string, params?: unknown[]) =>
        call(sql, async () => {
          await host.query(sql, params);
          return ours(sql) ? mem.query(sql, params) : [];
        }),
      execute: (sql: string, params?: unknown[]) =>
        call(sql, async () => {
          await host.execute(sql, params);
          return ours(sql) ? mem.execute(sql, params) : { rowCount: 0 };
        }),
    },
  });
  await plugin.definition.setup(harness.ctx);
  return { harness, mem };
}

describe("the worker's office data handler and prune timer (SDK test harness)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves the 5m envelope, not the 11m one, and prunes the 25h one on a poll", async () => {
    const { harness, mem } = await startWorker("2026-10-02T12:00:00.000Z");
    const now = Date.now();
    const at = (ms: number) => new Date(now - ms).toISOString();
    await recordHandoffs(mem, CO, [
      { kind: "reassign", from: ADA, to: BO, issue: "NWR-025", issueId: "i25", at: at(25 * 60 * 60_000) },
      { kind: "reassign", from: ADA, to: BO, issue: "NWR-011", issueId: "i11", at: at(11 * 60_000) },
      { kind: "delegate", from: LEAD, to: CY, issue: "NWR-005", issueId: "i5", at: at(5 * 60_000) },
    ]);
    harness.seed({ issues: POLLS[0].issues as never });

    const data = await harness.getData<{ handoffs: Handoff[] }>("office", { companyId: CO });
    expect(data.handoffs).toEqual([{ kind: "delegate", from: LEAD, to: CY, issue: "NWR-005", issueId: "i5", at: at(5 * 60_000) }]);
    expect(mem.rows.map((r) => r.issue_label)).toEqual(["NWR-011", "NWR-005"]);
  });

  it("records fixture handoffs through the real handler", async () => {
    const { harness, mem } = await startWorker(POLLS[0].polledAt);
    const served: Handoff[][] = [];
    for (const p of POLLS.slice(0, 4)) {
      vi.setSystemTime(new Date(p.polledAt));
      harness.seed({ issues: p.issues as never });
      served.push((await harness.getData<{ handoffs: Handoff[] }>("office", { companyId: CO })).handoffs);
    }
    expect(served).toEqual([[], [ADA_TO_BO, LEAD_TO_CY], [ADA_TO_BO, LEAD_TO_CY], [ADA_TO_BO, LEAD_TO_CY, CY_TO_LEAD]]);
    expect(mem.rows).toHaveLength(3);
  });

  it("prunes on a timer while nobody has the office open", async () => {
    const { mem } = await startWorker("2026-10-02T12:00:00.000Z");
    await recordHandoffs(mem, CO, [{ kind: "reassign", from: ADA, to: BO, issue: "OLD", at: new Date(Date.now() - 25 * 60 * 60_000).toISOString() }]);
    await vi.advanceTimersByTimeAsync(PRUNE_EVERY_MS - 1000);
    expect(mem.rows).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mem.rows).toHaveLength(0);
  });
});

describe("office_events failures never take the office down (real handler, fake ctx.db that throws)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const AGENTS = [
    { id: LEAD, name: "Lead", role: "cto", title: "Engineering Lead", reportsTo: null },
    { id: ADA, name: "Ada", role: "engineer", title: null, reportsTo: LEAD },
    { id: BO, name: "Bo", role: "engineer", title: null, reportsTo: LEAD },
    { id: CY, name: "Cy", role: "engineer", title: null, reportsTo: LEAD },
  ].map((a) => ({ ...a, companyId: CO, status: "idle" }));

  interface OfficeResponse {
    handoffs: Handoff[];
    agents: Array<{ id: string }>;
    tasks: unknown[];
    layout?: unknown;
  }

  async function open(harness: Awaited<ReturnType<typeof startWorker>>["harness"], p: Poll): Promise<OfficeResponse> {
    vi.setSystemTime(new Date(p.polledAt));
    harness.seed({ issues: p.issues as never });
    return harness.getData<OfficeResponse>("office", { companyId: CO });
  }

  async function started(fault: OfficeEventsFault = {}) {
    const w = await startWorker(POLLS[0].polledAt, fault);
    w.harness.seed({ agents: AGENTS as never });
    return w;
  }

  const warnings = (harness: Awaited<ReturnType<typeof startWorker>>["harness"]) =>
    harness.logs.filter((l) => l.level === "warn").map((l) => ({ message: l.message, error: String(l.meta?.error ?? "") }));

  const unavailable = { message: "office: handoffs unavailable", error: expect.stringContaining("office_events\" does not exist") };

  it.each<[string, OfficeEventsFault]>([
    ["reads throw", { reads: true }],
    ["writes throw", { writes: true }],
    ["reads and writes throw", { reads: true, writes: true }],
    ["ctx.db throws synchronously", { reads: true, writes: true, sync: true }],
  ])("%s: the office is served with an empty handoffs list and a warning", async (_, broken) => {
    const fault: OfficeEventsFault = {};
    const { harness } = await started(fault);
    expect((await open(harness, POLLS[0])).handoffs).toEqual([]); // healthy baseline poll

    Object.assign(fault, broken);
    const data = await open(harness, POLLS[1]); // the poll that finds Ada>Bo and Lead>Cy

    expect(data.handoffs).toEqual([]);
    expect(data.agents.map((a) => a.id).sort()).toEqual([LEAD, ADA, BO, CY].sort());
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.layout).toBeDefined();
    expect(warnings(harness)).toEqual([unavailable]);
    expect(harness.logs.filter((l) => l.level === "error")).toEqual([]);
  });

  it("fails every poll while the table is broken, from the very first", async () => {
    const { harness } = await started({ reads: true, writes: true });
    for (const p of POLLS.slice(0, 3)) expect((await open(harness, p)).handoffs).toEqual([]);
    // The first poll also runs the (throttled) prune, which fails and logs on its own.
    const pruneFailed = { message: "office: office event prune failed", error: expect.stringContaining("does not exist") };
    expect(warnings(harness)).toEqual([pruneFailed, unavailable, unavailable, unavailable]);
  });

  it("recovers on the next poll once the table is back; handoffs found while it was down are not recorded", async () => {
    const fault: OfficeEventsFault = {};
    const { harness, mem } = await started(fault);
    await open(harness, POLLS[0]);
    fault.writes = true;
    expect((await open(harness, POLLS[1])).handoffs).toEqual([]);
    fault.writes = false;
    expect((await open(harness, POLLS[2])).handoffs).toEqual([]); // Ada>Bo and Lead>Cy were lost with the failed write
    expect((await open(harness, POLLS[3])).handoffs).toEqual([CY_TO_LEAD]);
    expect(mem.rows.map((r) => r.issue_label)).toEqual(["NWR-104"]);
  });

  it("a failing prune alone does not empty the office: the envelopes are still served", async () => {
    const { harness, mem } = await started({ prunes: true });
    const recent: Handoff = { ...ADA_TO_BO, at: new Date(Date.parse(POLLS[0].polledAt) - 60_000).toISOString() };
    await recordHandoffs(mem, CO, [recent]);
    expect((await open(harness, POLLS[0])).handoffs).toEqual([recent]);
    expect(warnings(harness)).toEqual([{ message: "office: office event prune failed", error: expect.stringContaining("does not exist") }]);
  });

  it("a failing prune on the timer is logged, not thrown", async () => {
    for (const sync of [false, true]) {
      const { harness } = await startWorker("2026-10-02T12:00:00.000Z", { writes: true, sync });
      await vi.advanceTimersByTimeAsync(PRUNE_EVERY_MS);
      expect(warnings(harness)).toContainEqual({ message: "office: office event prune failed", error: expect.stringContaining("does not exist") });
      vi.useRealTimers();
    }
  });
});

describe("restarts and quiet polls (real handler)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  type Harness = Awaited<ReturnType<typeof startWorker>>["harness"];
  const MIN = 60_000;

  /** One office poll: the host's issues are now `p.issues`, and the clock reads `at` (default: the poll's own time). */
  async function officePoll(harness: Harness, p: Poll, at = p.polledAt): Promise<Handoff[]> {
    vi.setSystemTime(new Date(at));
    harness.seed({ issues: p.issues as never });
    return (await harness.getData<{ handoffs: Handoff[] }>("office", { companyId: CO })).handoffs;
  }
  const later = (p: Poll, ms: number) => new Date(Date.parse(p.polledAt) + ms).toISOString();
  const inserts = (mem: ReturnType<typeof memoryDb>) => mem.statements.filter((s) => s.trim().startsWith("INSERT")).length;

  it("the first poll after a restart serves the recent envelopes from the table, and writes nothing", async () => {
    const before = await startWorker(POLLS[0].polledAt);
    await officePoll(before.harness, POLLS[0]);
    expect(await officePoll(before.harness, POLLS[1])).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(before.mem.rows).toHaveLength(2);

    // Restart 30s later: new process memory (no diff baseline), same office_events table.
    const after = await startWorker(later(POLLS[1], 30_000), {}, before.mem);
    expect(await officePoll(after.harness, POLLS[2], later(POLLS[1], 30_000))).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(after.mem.rows).toHaveLength(2);
    expect(inserts(after.mem)).toBe(1); // only the one from before the restart

    // The new worker keeps recording on top of what the old one wrote.
    expect(await officePoll(after.harness, POLLS[3], later(POLLS[1], 34_000))).toEqual([
      ADA_TO_BO,
      LEAD_TO_CY,
      { ...CY_TO_LEAD, at: later(POLLS[1], 34_000) },
    ]);
    expect(after.mem.rows).toHaveLength(3);
  });

  it("after a restart, envelopes older than 10 minutes stay in the table but are not served", async () => {
    const before = await startWorker(POLLS[0].polledAt);
    await officePoll(before.harness, POLLS[0]);
    await officePoll(before.harness, POLLS[1]);

    const after = await startWorker(later(POLLS[1], 11 * MIN), {}, before.mem);
    expect(await officePoll(after.harness, POLLS[1], later(POLLS[1], 11 * MIN))).toEqual([]);
    expect(after.mem.rows).toHaveLength(2);
  });

  it("a change made while the worker was down is not recorded: the first poll after a restart is a baseline", async () => {
    const before = await startWorker(POLLS[0].polledAt);
    await officePoll(before.harness, POLLS[0]);
    await officePoll(before.harness, POLLS[1]);

    // Cy>Lead (poll 4's reassignment) happens during the restart.
    const after = await startWorker(POLLS[3].polledAt, {}, before.mem);
    expect(await officePoll(after.harness, POLLS[3])).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(after.mem.rows).toHaveLength(2);
  });

  it("consecutive polls with no changes write no rows and serve the same envelopes", async () => {
    const { harness, mem } = await startWorker(POLLS[0].polledAt);
    await officePoll(harness, POLLS[0]);
    const first = await officePoll(harness, POLLS[1]);
    expect(first).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(mem.rows).toHaveLength(2);

    // The same snapshot, polled again and again on the 4s refresh.
    for (let i = 1; i <= 5; i++) expect(await officePoll(harness, POLLS[1], later(POLLS[1], i * 4000))).toEqual(first);
    expect(mem.rows).toHaveLength(2);
    expect(inserts(mem)).toBe(1);

    // On through fixture polls 3 to 5 (5 is identical to 4): one new row at poll 4, then none.
    await officePoll(harness, POLLS[2], later(POLLS[1], 24_000));
    await officePoll(harness, POLLS[3], later(POLLS[1], 28_000));
    await officePoll(harness, POLLS[4], later(POLLS[1], 32_000));
    expect(mem.rows.map((r) => `${r.handoff_kind} ${r.issue_label}`)).toEqual(["reassign NWR-101", "delegate NWR-104", "reassign NWR-104"]);
    expect(inserts(mem)).toBe(2);
  });

  it("two overlapping polls of the same snapshot (the page and the widget) write each handoff once", async () => {
    const { harness, mem } = await startWorker(POLLS[0].polledAt);
    await officePoll(harness, POLLS[0]);
    vi.setSystemTime(new Date(POLLS[1].polledAt));
    harness.seed({ issues: POLLS[1].issues as never });
    const [page, widget] = await Promise.all([
      harness.getData<{ handoffs: Handoff[] }>("office", { companyId: CO }),
      harness.getData<{ handoffs: Handoff[] }>("office", { companyId: CO }),
    ]);
    expect(page.handoffs).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(widget.handoffs).toEqual([ADA_TO_BO, LEAD_TO_CY]);
    expect(mem.rows).toHaveLength(2);
  });
});

describe("handoffsSent for the Wall of Fame, from the log", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const DAY = 24 * 60 * 60_000;
  const AGENTS = [
    { id: LEAD, name: "Lead", role: "cto", title: "Engineering Lead", reportsTo: null },
    { id: ADA, name: "Ada", role: "engineer", title: null, reportsTo: LEAD },
    { id: BO, name: "Bo", role: "engineer", title: null, reportsTo: LEAD },
    { id: CY, name: "Cy", role: "engineer", title: null, reportsTo: LEAD },
  ].map((a) => ({ ...a, companyId: CO, status: "idle" }));
  const sentBy = (rec: RecognitionData) => Object.fromEntries(rec.leaderboard.map((s) => [s.name, s.handoffsSent]));
  const envelope = (from: string, to: string, at: string, issue = "NWR-1"): Handoff => ({ kind: "reassign", from, to, issue, at });

  it("reads at most 5000 rows, newest first, and warns when it hits the limit", async () => {
    expect(HANDOFF_COUNT_LIMIT).toBe(5000);
    const db = memoryDb();
    const logger = quietLogger();
    const t = (s: number) => new Date(Date.UTC(2026, 9, 2, 12, 0, s)).toISOString();
    await recordHandoffs(db, CO, [envelope(ADA, BO, t(1)), envelope(BO, CY, t(2)), envelope(CY, LEAD, t(3))]);

    expect(await loadHandoffsSent(db, logger, CO, new Date(0))).toHaveLength(3);
    expect(db.statements.at(-1)).toMatch(/LIMIT 5000$/);
    expect(logger.warn).not.toHaveBeenCalled();

    const capped = await loadHandoffsSent(db, logger, CO, new Date(0), 2);
    expect(capped.map((h) => h.from)).toEqual([BO, CY]); // the newest two
    expect(logger.warn).toHaveBeenCalledWith("office: handoff counts truncated", { companyId: CO, limit: 2, oldestCounted: t(2) });
  });

  it("the recognition handler counts each agent's logged handoffs over the last 30 days, for this company only", async () => {
    const { harness, mem } = await startWorker("2026-10-02T12:00:00.000Z");
    harness.seed({ agents: AGENTS as never });
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    await recordHandoffs(mem, CO, [envelope(ADA, BO, ago(60_000)), envelope(ADA, CY, ago(2 * 60 * 60_000)), envelope(LEAD, ADA, ago(5 * 60_000))]);
    await recordHandoffs(mem, "another-company", [envelope(BO, ADA, ago(60_000)), envelope(BO, CY, ago(60_000))]);

    const rec = await harness.getData<RecognitionData>("recognition", { companyId: CO });
    expect(sentBy(rec)).toEqual({ Ada: 2, Lead: 1, Bo: 0, Cy: 0 });

    const read = mem.statements.filter((sql) => sql.includes("office_events")).at(-1)!;
    expect(read).toMatch(/^SELECT[\s\S]*LIMIT 5000$/);
    expect(harness.logs.filter((l) => l.level === "warn")).toEqual([]);
  });

  it("counts the handoffs the office itself logged from the fixture polls", async () => {
    const { harness } = await startWorker(POLLS[0].polledAt);
    harness.seed({ agents: AGENTS as never });
    for (const p of POLLS.slice(0, 4)) {
      vi.setSystemTime(new Date(p.polledAt));
      harness.seed({ issues: p.issues as never });
      await harness.getData("office", { companyId: CO });
    }
    // Ada>Bo (reassign), Lead>Cy (delegate), Cy>Lead (reassign)
    expect(sentBy(await harness.getData<RecognitionData>("recognition", { companyId: CO }))).toEqual({ Ada: 1, Lead: 1, Cy: 1, Bo: 0 });
  });

  it("asks the log for the month window; rows beyond 24h are already pruned, so old handoffs are not counted", async () => {
    const { harness, mem } = await startWorker("2026-10-02T12:00:00.000Z");
    harness.seed({ agents: AGENTS as never, issues: POLLS[0].issues as never });
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    await recordHandoffs(mem, CO, [envelope(ADA, BO, ago(3 * DAY)), envelope(ADA, BO, ago(60_000))]);

    // Before any prune, the month-wide read sees both.
    expect(sentBy(await harness.getData<RecognitionData>("recognition", { companyId: CO })).Ada).toBe(2);
    expect(mem.queryParams.at(-1)).toEqual([CO, "handoff", ago(30 * DAY)]);
    // An office poll prunes the 3-day-old row (24h retention); recognition then counts only the last day.
    await harness.getData("office", { companyId: CO });
    expect(sentBy(await harness.getData<RecognitionData>("recognition", { companyId: CO })).Ada).toBe(1);
  });

  it("a failing log leaves the Wall of Fame up with zero handoffs and a warning", async () => {
    const { harness, mem } = await startWorker("2026-10-02T12:00:00.000Z", { reads: true });
    harness.seed({ agents: AGENTS as never });
    await recordHandoffs(mem, CO, [envelope(ADA, BO, new Date().toISOString())]);

    const rec = await harness.getData<RecognitionData>("recognition", { companyId: CO });
    expect(sentBy(rec)).toEqual({ Lead: 0, Ada: 0, Bo: 0, Cy: 0 });
    expect(rec.leaderboard).toHaveLength(4);
    expect(harness.logs.filter((l) => l.level === "warn").map((l) => l.message)).toEqual(["office: handoff counts unavailable"]);
  });
});

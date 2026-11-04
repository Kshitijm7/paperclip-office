# Test fixtures

Paperclip data as the worker receives it, replayed by the specs without a live server.

## `handoff-polls.jsonl`

One line per poll of the office data handler (`ctx.data.register(DATA_KEY)` in `src/worker.ts`), oldest first:

| Field | What |
|---|---|
| `polledAt` | The worker's clock for that poll (the `now` handoffs are stamped with) |
| `companyId` | The company polled |
| `note` | What changed since the previous line, and which envelopes it should produce |
| `issues` | The `ctx.issues.list({ companyId })` result for that poll, in the SDK `Issue` shape (dates as ISO strings, as they arrive over the worker RPC) |

The company, agents and issues are fictional. These lines were written by hand in the SDK's shape, not
captured from a running Paperclip. When a real capture is available, anonymise the ids and names and
replace or add lines; `tests/office-events.spec.ts` states the envelopes each poll must produce.

## `handoff-delegate-return-polls.jsonl`

Same format and company. It covers the `delegate` envelope for a child assigned after it was created, the
`return` envelope for a child moving to done, a child reassigned and done in one poll, a child done twice
(reopened in between), and the near misses that must send nothing: top-level issues, unassigned or unlisted
parents, the parent's own assignee, and a child done and unassigned at once.

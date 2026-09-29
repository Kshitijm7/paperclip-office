# PRD: paperclip-office v1

Status: draft for approval, 2026-09-28. Plan context lives in `CLAUDE.md`; this file fixes the v1 scope.

## 1. Goal

A Paperclip plugin that shows any company as the munder-difflin office, live. It should look exactly like munder-difflin (same floor plan, desks, characters, bubbles, envelopes, camera) but dressed in Paperclip's colors and naming, so it reads as native to Paperclip. Upstream code stays untouched.

## 2. v1 scope

In:

1. **Office view** (plugin page). Every agent at a desk, live state, tool bubble, thought bubble, envelopes between desks.
2. **State board.** One row per agent: state, current issue, current run, time in state, last tool.
3. **Stuck detector.** Default threshold 10 minutes, configurable per company. Shows as a red desk and a red row.
4. **Dashboard widget.** Count per state, red dot when anything is stuck. Click opens the Office view.

Out (v2+): Flow Map, Comms Map, Replay, `office_status` agent tool, bottleneck panel.

## 3. Look: exactly Mifflin, inside Paperclip

Nothing in `vendor/` changes. Upstream's imports are redirected at build time (`esbuild.config.mjs`, mirrored in `tsconfig.json` paths):

| Upstream import | Goes to | Why |
|---|---|---|
| `@/store/store` | `src/adapters/store.ts` | zustand vanilla store plus React's `useSyncExternalStore`. zustand's React binding pulls in a CommonJS `require("react")` the host cannot resolve. |
| `@/design/tokens` | `src/adapters/tokens.ts` | Upstream colors, host font stack |
| `react-i18next` | `src/adapters/i18n.ts` | Paperclip-neutral chatter lines |
| `@/assets/maps`, `@/assets/tilesets` | `assets/local/` | LimeZu art, see below |
| `window.cth` (Electron bridge) | `src/ui/OfficeScene.tsx` | Task board from issues, envelopes from handoffs |

**Art.** `npm run build` runs `scripts/fetch-art.mjs`, which downloads the maps and tilesets from upstream at the locked commit into `assets/local/` (gitignored). They are inlined into `dist/ui/index.js` as data URLs because the host loads plugin UI from a blob URL, where relative asset URLs cannot resolve. Never commit or publish `assets/local/` or a `dist/` built with it.

**Cast.** The top of the org chart gets Michael's office (upstream's "god" seat). Everyone else gets the next cast member in agent id order.

## 4. State mapping (checked against a live 17-agent company on 2026-09-28)

| Board state | Scene pose | Rule |
|---|---|---|
| working | seated, focused | Latest run is live and has `last_output_at` |
| thinking | seated | Latest run is live, no output yet |
| blocked | seated, "waiting" | No live run, current issue `blocked`. Upstream's door-walk pose is kept for a pending approval only, since most Paperclip blocks are dependencies, not a human ask. |
| idle | wanders | No live run |
| stuck | spinning warning glyph | Live run with no output for N minutes (default 10), or an issue in progress with no run and no update for N minutes |

A run over a time budget is not a stuck rule: Paperclip exposes no budget for it, so we don't invent one.

Envelope A to B: an issue reassigned from A to B, or a new child issue whose parent belongs to A. The worker diffs issue snapshots between polls; no event subscription and no database table.

## 5. Architecture

- **Worker** (`src/worker.ts`): one data handler, `office`. Reads `ctx.agents.list`, `ctx.issues.list` and the core table `public.heartbeat_runs`, returns a snapshot. The pure mapping lives in `src/shared/office.ts`.
- **UI** (`src/ui/`): Office page (scene, counts, fullscreen button, state board), sidebar link, dashboard widget. Polls every 4 seconds and keeps the last snapshot so the scene never remounts.
- **Deploy:** `node <paperclip>/node_modules/paperclipai/dist/index.js plugin install <this dir> --api-base http://127.0.0.1:3100`. After a worker change: `plugin disable` then `plugin enable`.

## 6. Determinism and tests

- Zero model tokens: the scene is pure Pixi code and the worker only reads existing run events.
- Desk placement sorted by agent id, seeded PRNG per agent. Snapshot test of placement.
- Idle animation seeded: the Office page replaces `Math.random` with a PRNG seeded from the company id (upstream calls it in `Character.ts` and `OfficeFloor.tsx`). No `vendor/` edit. The same company wanders the same way on every load.
- Idle chatter kept, reworded through the `react-i18next` shim.
- `tests/office.spec.ts`: state mapping, stuck rule, stable cast placement, handoff diff. No live server.
- `sync-upstream.ps1 -Verify` passes in CI.

## 7. Acceptance criteria

1. Installs on a real company (17 agents) and every agent appears at a desk.
2. Side by side with munder-difflin, the floor plan, desk layout and animations match; colors and fonts match Paperclip.
3. An agent that starts a run moves from idle to thinking or working within 5 seconds.
4. Reassigning an issue sends an envelope between the two desks.
5. A run with no event for 10 minutes shows a red desk, a red board row and a red widget dot.
6. Same company renders the same office on every load.
7. `-Verify` passes: `vendor/` is byte-identical to the lock.
8. No LimeZu file in git or in the published package.

## 8. Build order

1. Scaffold from Git Graph, alias config, build passes with upstream code. (~half a day)
2. Record a real event stream, confirm the state table. (~2 hours)
3. Worker and `office_events`. (~1 day)
4. Adapter store plus fixture tests. (~1 day)
5. Paperclip tokens, generated tiles, traced map; Office view renders. (~1 to 2 days)
6. State board, stuck detector, widget. (~1 day)
7. README, screenshots, CI, publish. (~half a day)

## 9. Open questions

1. Resolved: no run time budget in Paperclip, rule dropped.
2. Resolved: Paperclip has no fullscreen slot; a `page` slot always mounts inside the app frame at `/:companyPrefix/<routePath>`. The Office page opens there and has a fullscreen button (browser Fullscreen API on the scene container, Esc exits).

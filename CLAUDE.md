# paperclip-office

A Paperclip plugin that shows an agent company as a live office. Every agent sits at a desk and shows what it's doing right now (thinking, working, blocked, idle). Work moves between desks as envelopes. A second view, the Flow Map, shows the same traffic as a pipeline. It works for any Paperclip company, whatever the team size or domain. It's open source and published on Kshitijm7's GitHub.

Started 2026-09-27. Sibling of [paperclip-git-graph](https://github.com/Kshitijm7/paperclip-git-graph), which provides the scaffold, the build setup and the live-run code we reuse.

## What we are building

1. **Office view.** munder-difflin's Pixi.js office floor, driven by Paperclip data instead of local terminals.
2. **Flow Map.** Org chart lanes with issue cards moving through queued, in progress, in review, blocked and done. Shows queue depth and wait time per agent, and where work piles up.
3. **Comms Map.** A graph of who sends work or messages to whom. Edge weight is volume, and an edge pulses when something moves along it. The log under it answers "who told whom what, and when".
4. **Utility, beyond the picture:**
   - Agent state board: one row per agent with its state, current issue, current run, time in that state and last tool used.
   - Stuck detector: an agent working with no event for N minutes, an issue in progress with no run, a run over its time budget. It shows as a red desk, a dashboard widget and a plugin metric.
   - Bottleneck panel: agents with the longest queue and the oldest waiting issue.
   - Replay: scrub the last 24 hours of events and watch the office play back.
   - Agent tool `office_status`: agents (usually a Chief or a Lead) can ask who is idle, who is stuck and who is overloaded before assigning work.
   - Dashboard widget: counts per state, plus a red dot when anything is stuck.

## Where the data comes from (Paperclip, not upstream)

Upstream drives its scene from terminal hooks. We drive it from the Paperclip plugin SDK.

| Scene concept | Paperclip source |
|---|---|
| Agent at a desk | `agents.read`, placed by org chart (manager rows, reports beside them) |
| `working` | Live run with a recent tool-call event |
| `thinking` | Live run whose last event is model output or nothing yet |
| `blocked` | The agent's current issue is `blocked`, or a pending approval |
| `idle` | No live run |
| Envelope A to B | Issue assigned or reassigned, a comment mentioning B, or a child issue created |
| Tool bubble | Latest tool name in the run stream |
| Thought bubble | Short tail of the run's latest text output |

Reuse `paperclip-git-graph/src/worker/live.ts` for run events, and follow its SDK patterns (`docs/sdk-reference.md` there). Treat the state mapping as a hypothesis and confirm each row against the real event stream before building on it.

## Upstream: munder-difflin

- Repo: https://github.com/chaitanyagiri/munder-difflin (MIT, Chaitanya Giri). It's an Electron desktop app, not a library, so we copy a pinned subset rather than install it.
- What we copy is listed in `upstream/upstream.json`: the `scene/office` module (Pixi office, characters, bubbles, envelopes, camera, pathfinding, themes), `design/tokens.ts`, the licenses and `ATTRIBUTION.md`.
- The pin lives in `upstream/upstream.lock.json`: the exact commit plus a SHA-256 for every copied file.

### Rule 1: never edit `vendor/`

`vendor/munder-difflin/` is byte-identical to upstream at the locked commit. All changes go outside it:

- **Alias shims.** Upstream imports `@/store/store`, `@/design/tokens` and `@/assets/...`. Our build maps those aliases to `src/adapters/` instead of upstream's app. So `@/store/store` becomes a store fed by Paperclip data, and `@/design/tokens` becomes Paperclip's design language (host CSS variables, the same token map as Git Graph's `src/theme/`). Upstream code runs unmodified, against our data and our look.
- **File override.** If a single upstream file can't be adapted through its imports, alias that one module to our own file in `src/overrides/`. Record the reason in `upstream/overrides.md`. Every override is a file we maintain by hand after each sync, so keep the list short.
- **Wrap, don't fork.** New behaviour (Flow Map, Comms Map, stuck detector, replay) lives in our own `src/` and uses upstream classes from outside.

### Rule 2: every import goes through the gate

```powershell
./scripts/sync-upstream.ps1              # upstream main
./scripts/sync-upstream.ps1 -Ref v0.5.3  # a tag or a commit
./scripts/sync-upstream.ps1 -Verify      # vendor/ still matches the lock?
```

What the import does:

1. Refuses to run on a dirty tree.
2. Clones upstream at the ref and resolves it to a commit SHA.
3. Creates the branch `upstream/<sha8>`, which never touches `main`.
4. Replaces `vendor/`, copies only the `include` paths and drops the `exclude` paths.
5. Writes the lock with the old commit, the new commit and a hash per file.
6. Runs the gates `npm ci`, `typecheck`, `test` and `build`. If any gate fails, the branch is deleted and nothing is imported.
7. Commits on the branch and prints the review and merge commands. A person merges with `--ff-only` after looking at the diff.

`-Verify` runs in CI and before release. It fails if anyone edited `vendor/`, which is Rule 1 enforced.

If an upstream path in `include` disappears or is renamed, the import fails loudly. Fix `upstream.json` and the adapters, then re-run.

## Determinism

- Pinned by commit SHA, never a moving branch. `ref: main` only chooses what to import. The lock records what was actually imported.
- A SHA-256 for every vendored file, checked by `-Verify`.
- `.gitattributes` marks `vendor/**` as `-text`, so git never rewrites line endings and hashes stay stable on Windows.
- `npm ci` against the committed `package-lock.json`. Exact versions for `pixi.js` and every runtime dependency upstream's scene needs (read them from upstream's `package.json` at the locked commit).
- The scene layout is a pure function of (org chart, theme, seed). Desk placement sorts agents by id, and animation randomness uses a seeded PRNG keyed on agent id. The same company always renders the same office. Tests assert this with a snapshot of the placement.
- Tests replay recorded Paperclip event fixtures (`tests/fixtures/*.jsonl`) through the adapter and check the resulting states and envelopes. No test depends on a live server.

## Art assets: licensing constraint

Upstream bundles LimeZu "Modern Interiors" tilesets and maps. Their licence allows use but **forbids redistribution**. They are in `exclude` and must never be committed or published here.

- Default look: a floor drawn in code, in the Paperclip design language. Characters are fine to ship, because upstream draws them procedurally in `portraitArt.ts` under MIT.
- Optional: a user who owns the LimeZu pack drops the files into `assets/local/` (gitignored), and the theme loader uses them when present.
- Always keep upstream's `LICENSE`, `LICENSE-ASSETS` and `ATTRIBUTION.md` in `vendor/`, and credit munder-difflin in `NOTICE` and the README.

## Paperclip design language

Match the host rather than upstream's Dunder Mifflin palette. That means host CSS variables for surface, text, accent and state colors, the same state colors as the Paperclip agent list, Paperclip naming (agents, issues, runs, approvals; "Chief" and "Lead" come from agent roles, never from hard-coded Office names), and no parody characters by default. Upstream's theme stays available as an opt-in preset. Keep the token map in `src/adapters/tokens.ts`, one place, following `paperclip-git-graph/docs/design-language.md`.

## Build order

1. Scaffold from paperclip-git-graph: package.json, esbuild config, manifest, worker, UI entry, vitest. Add alias config for `@/` pointing to `src/adapters/`, with a fallback to `vendor/munder-difflin/src/renderer/src/`.
2. Worker: agents, org chart, live runs and issue events, persisted to the plugin database as a normalized event log (`office_events`).
3. The adapter store from Rule 1, with fixture tests.
4. Office view on the default drawn floor.
5. State board and stuck detector, then the widget, then the `office_status` tool.
6. Flow Map, then Comms Map, then Replay.
7. README, screenshots, `-Verify` in CI, then publish.

## Commands (after scaffold)

```bash
npm install
npm run build
npm run typecheck
npm test
node <paperclip>/node_modules/paperclipai/dist/index.js plugin install <this dir> --api-base http://127.0.0.1:3100
```

Manifest changes need `plugin uninstall <key> --force` followed by `plugin install`. A rebuild only reloads the worker and UI (see Git Graph's CLAUDE.md).

## Licence

Our code: Apache-2.0 (same as Git Graph). Vendored munder-difflin code: MIT, which is compatible. Keep its copyright notice.

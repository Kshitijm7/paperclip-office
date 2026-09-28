# Office layouts: how the canvas is built, and how to make a new one

Read this before building or changing a layout. It records what we learned getting the office to render inside Paperclip, so the next layout takes hours, not days.

## 1. How the canvas gets on screen

- The scene is munder-difflin's Pixi office, vendored unchanged in `vendor/`. We never edit it.
- The build (`esbuild.config.mjs`) redirects upstream's imports:
  - `@/store/store` goes to `src/adapters/store.ts` (a zustand vanilla store plus React's `useSyncExternalStore`). zustand's React binding pulls in a CommonJS `require("react")` that the host can't resolve.
  - `@/design/tokens` goes to `src/adapters/tokens.ts`.
  - `react-i18next` goes to `src/adapters/i18n.ts`, which holds our chatter lines in en, ar and zh-CN.
  - `@/assets/*` goes to `assets/local/*`, the LimeZu art fetched by `scripts/fetch-art.mjs`. The art is gitignored and must never be committed or published.
- File overrides, listed in `upstream/overrides.md`:
  - `themeLoader` adds the `generated` theme and records the loaded map for the wall plaque and the heatmap.
  - `Camera` registers the live camera. That gives us zoom, whole floor, zoom-on-select, and a hook for hanging Pixi objects into the world (the plaque and the heat rugs).
- Paperclip loads plugin UI from a blob URL, so relative asset URLs don't resolve. PNGs are inlined as data URLs and maps as raw text.
- The scene talks to Electron through `window.cth`. `src/ui/OfficeScene.tsx` fakes it:
  - `hiveTasks` feeds the task board and the ASK ME board. The ASK ME board counts blocked tasks with an unanswered `humanQA` entry, so each pending approval becomes one.
  - `onHiveMessage` makes envelopes fly.
- Boards clicked in the scene call `requestCommandCenterTab(tab)`. `SceneControls` maps those tabs to Paperclip routes: `/inbox`, `/issues`, `/routines`.

## 2. Things that broke, and why

| Symptom | Cause | Fix |
|---|---|---|
| Plugin page shows only "Office: Office" | Bundle imports `react` via CommonJS `require` | Vanilla zustand store; keep `require("react")` count at 0 in `dist/ui/index.js` |
| Everyone queues at the door | Scene remounted every poll (data briefly `undefined`) | `useOffice` keeps the last good snapshot |
| Every task animates as "new" | Task board's first poll is its baseline and ran before data | Don't mount `OfficeFloor` until data exists |
| Characters invisible, frozen | Browser pane hidden, so `requestAnimationFrame` stops | Not a bug; check `ticker.lastTime` before debugging |
| Dialog missing in fullscreen | Rendered outside the fullscreen element | Mount dialogs and controls inside the scene container |
| `node_modules` emptied | `git worktree remove --force` followed a junction | Subagents run `npm ci`, never junction |
| Office data 502 | Guessed SQL column (`scope_name`) | Read columns from `@paperclipai/db/dist/schema/*.js`; wrap optional loads in `optional()` |
| Cost shows $0.00 | Subscription runs record 0 cents | `costMetric: auto` shows tokens instead |

## 3. Making a generated layout (`src/layout/generate.ts`)

- **Input:** departments in seating order (`sceneDepartments`), with the chief left out because the chief takes `desk-ceo`.
- **Output:** a Tiled map with the same layers and tilesets as `office.tmj`, plus seat names and anchors.
- **Tunables live in one `LayoutSpec`** (`src/layout/spec.ts`, validated by `normalizeLayoutSpec`, which never throws). Presets are in `src/layout/presets.ts`: departments, open-plan, compact, campus. A new layout is usually just a new preset. Only wall height (3) and door width (2) are fixed by the art.
- **Choosing a layout:** the Layout button in the scene saves a per-company choice in plugin state, which overrides the `theme`/`layoutPreset` settings. "Ask an agent to design…" creates an issue for `layoutDesignerAgentId` (default: top of the org chart); the agent answers with the `office_set_layout` tool, and the result shows as "Agent-designed".
- **Rooms are copied from `office.tmj` at runtime (`TEMPLATE_ROOMS`), so their gids are never hard-coded:**
  - chief's office: x1–6, y3–7
  - boardroom: x9–17, y3–7
  - café: x25–32, y12–20
  - desk block `pc-1`: monitor 2 rows up, then desk, then chair
- **Gids we identified:**
  - Walls (a5): top 522, face 554, base 570, corners 514/517/578/581, sides 530/533, bottom 579, vertical wall 611/643.
  - Floors (a5, top-left of a 2x2 swatch): hall 781, CEO 777, boardroom 775, break area 801, filler 833. Departments cycle through 807, 809, 811, 805, 803, 815, 813, 779 and 783.
  - Props (office-tileset): bookshelf 153–155 over 169–171, plants 452/468 and 451/467, cooler 282/298, boxes 473/489, whiteboards 417–422 and 433–438, window 327/328 over 343/344, reception desk 2–4 and 18–20. The sofa (2178–2180 over 2194–2196) is from interiors.png.
  - Not in any tileset: ping-pong table, arcade, recliners.
- **Rules every layout must keep** (tests in `tests/generate.spec.ts`):
  1. Deterministic for the same departments.
  2. Every seat, café seat and stand is reachable from `entrance` through vendor `findPath`.
  3. The palette's monitor (LimeZu gid 365) sits two rows above every seat. Upstream only lights desks that face up, so pods can't face each other.
  4. Seat names: `desk-ceo`, `seat-<dept>-<i>`, `cafe-seat-*`, `lounge-seat-*`, `cafe-stand-coffee`, `cafe-stand-vending`, `entrance`.
  5. Seats are claimed in store order: the chief takes seat 0, then first free. `src/layout/seatAssignment.ts` mirrors this for overlays.
- **Preview without the browser:** render the map to PNG from the tilesets (Python with PIL, 16px tiles). Look at it, iterate, and save it under the scratchpad folder, never under `docs/` in git.

## 4. Hanging things in the scene

- The `Camera` override hands us the world container, so a Pixi object can be added at tile × 16.
- Z-order: `world.addChildAt(layer, 1)` puts it under characters (heat rugs). `addChild` puts it on top (the wall plaque).
- Text needs `resolution` of 4–6 or it blurs when zoomed.
- Find free wall with `findPlaqueTile`, the widest bare run in wall rows 1–2.

## 5. Art catalogue

`assets/catalogue.json` lists every art pack: source, licence class, path, tile size and what it provides.

- **Class A** (CC0, committed in `assets/free/`): Kenney Roguelike Indoors and Roguelike/RPG (16px tiles, 1px margin), Game Icons, UI Pack Grey and fonts. Only the combined sheets are kept, not the per-image folders.
- **Class B** (use allowed, never committed, lives in `assets/local/`): LimeZu Modern Interiors.
- **Not found in any free pack:** ping-pong table, arcade, recliners, server racks.
- Kenney is a flatter style than LimeZu, so use it as a full fallback theme or for icons, not mixed onto the same floor.

## 6. Palettes and the free (Kenney) theme

- `generateOfficeMap(departments, palette, spec)` only plans rooms, bands and corridors. Every gid comes from a `Palette` (`src/layout/generate.ts`): walls, floors, decor stamps, wall boards, window, the desk stamp and a `RoomStamp` for the chief's office, boardroom and cafe.
- `limezuPalette(template)` copies its rooms and desk out of `office.tmj` as before. `kenneyPalette()` (`src/layout/kenney.ts`) draws them from hand-written room plans, one character per tile.
- Kenney room plans keep `office.tmj`'s geometry (chief 6x5, boardroom 9x5, cafe 8x9, desk block 3x4, two wall rows above each room). That is what lets the vendor anchors (cafe seats, coffee tray, sink, errand spots) map through `mapTemplateTile` unchanged. Move a prop and you must check the anchor that points at it.
- The vendor `TiledMapRenderer` ignores tileset margin and spacing. The Kenney sheets have 1px gaps, so `scripts/pack-kenney.py` repacks them into gapless atlases in `assets/free/kenney/packed/` (committed, CC0). RPG pack is firstgid 1 (57 x 31), Indoors is firstgid 1768 (27 x 18).
- Every Kenney gid lives in `KENNEY_GIDS`, and `assets/catalogue.json` lists them per pack. When picking tiles from a labelled crop, the label sits above its tile. I misread labels as belonging to the tile above once, which shifts every id by one row. Always confirm a pick by rendering it.
- Kenney has no lit/unlit monitor pair, sofa or whiteboard. Desks use the blue-screen terminal (indoors 130); the free theme sets `monitor.offTopLeftGid` to -1 so `DeskScreen` never attaches (OfficeFloor only builds one when the gid matches, and `rt.screen` is optional everywhere). The lounge "sofa" is a table with chairs, boards are framed pictures.
- Colours: the hall is grey so the beige wall tops read as walls. Departments cycle green, orange, teal and wood carpet.

## 7. Building without LimeZu art

- `fetch-art` warns and carries on when a download fails. `scripts/esbuild-aliases.mjs` resolves any missing `@/assets/*` file to an empty stub, and the build defines `__LIMEZU__`, read through `src/shared/art.ts` (`HAS_LIMEZU`).
- Without LimeZu the UI maps every saved or configured theme to `free` (`availableTheme`) and the layout picker hides the Mifflin office and the LimeZu presets. The "Free art (Kenney)" entries are always shown.
- `OFFICE_ART_DIR=<dir>` points the build at another art folder; set it to a missing folder to test the no-LimeZu build. `tests/build-free-art.spec.ts` does this in-process.

## 8. Ideas not built yet

Facing pods (needs a monitor override), a minimap, per-department nameplates on doors, a meeting in the boardroom when agents share an issue, day and night lighting from the host clock.

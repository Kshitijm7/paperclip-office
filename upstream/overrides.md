# File overrides

Vendor modules replaced at build time (esbuild `upstream-aliases` plugin) when a vendor file imports them. Each one wraps the upstream module rather than copying it; re-check after every sync.

| Upstream module | Override | Why |
|---|---|---|
| `scene/office/themeLoader.ts` | `src/overrides/themeLoader.ts` | `loadTheme` only knows the static `THEMES` table. The override adds the `generated` theme (layout built from the org chart by `src/layout/`) and delegates every other id to upstream. |
| `scene/office/Camera.ts` | `src/overrides/Camera.ts` | OfficeFloor keeps its `Camera` in a closure, so the UI cannot reach it. The subclass registers the live instance for the "Whole floor" button and turns the select nudge into a zoom. |
| `scene/office/Character.ts` | `src/overrides/Character.ts` | OfficeFloor keeps each `Character` in a closure too, and its sprite carries no agent id. The subclass registers/unregisters itself by `agentId` so `src/ui/agentLabels.ts` can read `getPixelPosition()` every frame and draw nameplates/issue tags/state rings that follow the walking sprite. |

`tsc` still type-checks OfficeFloor against the upstream files (tsconfig paths cannot remap relative imports), so each override must keep the upstream export signatures.
| `scene/office/cafeteriaLines.ts` | `src/overrides/cafeteriaLines.ts` | Upstream's break-room chatter quotes The Office by name (Dunder Mifflin, Schrute Farms, "that's what she said"). The override keeps the two exported pickers with neutral workplace lines, per the no-parody default. |

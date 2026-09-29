import { OFFICE_THEME, type ErrandSpot, type ThemeConfig, type ThemeId } from "@/scene/office/themeRegistry";
import { generateOfficeMap, limezuPalette, mapTemplateTile, type DepartmentInput, type Palette, type TiledMapJson } from "./generate.js";
import { KENNEY_TILESETS, kenneyPalette } from "./kenney.js";
import { DEFAULT_SPEC, type LayoutSpec } from "./spec.js";
import rpgUrl from "../../assets/free/kenney/packed/rpg.png?url";
import indoorsUrl from "../../assets/free/kenney/packed/indoors.png?url";

export const GENERATED_THEME_ID = "generated" as ThemeId;
export const FREE_THEME_ID = "free" as ThemeId;

/** OFFICE_THEME with its map, seats and every layout-bound anchor moved into the generated floor. */
function buildTheme(id: ThemeId, palette: Palette, departments: DepartmentInput[], spec: LayoutSpec): Omit<ThemeConfig, "tilesets"> {
  const g = generateOfficeMap(departments, palette, spec);
  const move = <T extends { x: number; y: number }>(t: T) => mapTemplateTile(t, g.offsets) ?? t;
  const errandSpots: ErrandSpot[] = OFFICE_THEME.errandSpots
    .filter((e) => mapTemplateTile(e.stand, g.offsets) && mapTemplateTile(e.fx, g.offsets))
    .map((e) => ({ ...e, stand: move(e.stand), fx: move(e.fx) }));
  const c = OFFICE_THEME.coffee;
  return {
    ...OFFICE_THEME,
    id,
    mapRaw: JSON.stringify(g.map),
    primarySeatNames: ["desk-ceo", ...g.seatNames],
    cafeSeatNames: g.cafeSeatNames,
    coffee: { ...c, trayTile: move(c.trayTile), trayStand: move(c.trayStand), machineStand: move(c.machineStand), sinkTile: move(c.sinkTile), sinkStand: move(c.sinkStand) },
    anchors: { calendar: move(OFFICE_THEME.anchors.calendar), clock: move(OFFICE_THEME.anchors.clock), boards: g.boards },
    errandSpots,
  };
}

export function buildGeneratedTheme(departments: DepartmentInput[], spec: LayoutSpec = DEFAULT_SPEC): ThemeConfig {
  const palette = limezuPalette(JSON.parse(OFFICE_THEME.mapRaw) as TiledMapJson);
  return { ...buildTheme(GENERATED_THEME_ID, palette, departments, spec), tilesets: OFFICE_THEME.tilesets };
}

/** The generated floor drawn only from committed CC0 Kenney art; works without assets/local. */
export function buildFreeTheme(departments: DepartmentInput[], spec: LayoutSpec = DEFAULT_SPEC): ThemeConfig {
  const urls = [rpgUrl, indoorsUrl];
  return {
    ...buildTheme(FREE_THEME_ID, kenneyPalette(), departments, spec),
    tilesets: KENNEY_TILESETS.map((t, i) => ({ ...t, url: urls[i] })),
    // Kenney has no lit/unlit monitor pair; -1 never matches a gid, so DeskScreen never attaches.
    monitor: { offTopLeftGid: -1, onGids: [] },
  };
}

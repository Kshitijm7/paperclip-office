import { OFFICE_THEME, type ErrandSpot, type ThemeConfig, type ThemeId } from "@/scene/office/themeRegistry";
import { generateOfficeMap, mapTemplateTile, type DepartmentInput, type TiledMapJson } from "./generate.js";

export const GENERATED_THEME_ID = "generated" as ThemeId;

/** OFFICE_THEME with its map, seats and every layout-bound anchor moved into the generated floor. */
export function buildGeneratedTheme(departments: DepartmentInput[]): ThemeConfig {
  const template = JSON.parse(OFFICE_THEME.mapRaw) as TiledMapJson;
  const g = generateOfficeMap(departments, template);
  const move = <T extends { x: number; y: number }>(t: T) => mapTemplateTile(t, g.offsets) ?? t;
  const errandSpots: ErrandSpot[] = OFFICE_THEME.errandSpots
    .filter((e) => mapTemplateTile(e.stand, g.offsets) && mapTemplateTile(e.fx, g.offsets))
    .map((e) => ({ ...e, stand: move(e.stand), fx: move(e.fx) }));
  const c = OFFICE_THEME.coffee;
  return {
    ...OFFICE_THEME,
    id: GENERATED_THEME_ID,
    mapRaw: JSON.stringify(g.map),
    primarySeatNames: ["desk-ceo", ...g.seatNames],
    cafeSeatNames: g.cafeSeatNames,
    coffee: { ...c, trayTile: move(c.trayTile), trayStand: move(c.trayStand), machineStand: move(c.machineStand), sinkTile: move(c.sinkTile), sinkStand: move(c.sinkStand) },
    anchors: { calendar: move(OFFICE_THEME.anchors.calendar), clock: move(OFFICE_THEME.anchors.clock), boards: g.boards },
    errandSpots,
  };
}

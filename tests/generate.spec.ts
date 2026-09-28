import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPath } from "../vendor/munder-difflin/src/renderer/src/scene/office/pathfinding.js";
import { generateOfficeMap, limezuPalette, type Palette, type TiledMapJson } from "../src/layout/generate.js";
import { kenneyPalette } from "../src/layout/kenney.js";
import { LAYOUT_PRESETS } from "../src/layout/presets.js";

const TEMPLATE = "assets/local/maps/office.tmj";
const hasArt = existsSync(TEMPLATE);

function grid(map: TiledMapJson) {
  const col = map.layers.find((l) => l.name === "collision")!.data!;
  const spawns = new Map(map.layers.find((l) => l.name === "spawn-points")!.objects!.map((o) => [o.name, { x: o.x / 16, y: o.y / 16 }]));
  const walk = new Set([...spawns.values()].map((p) => `${p.x},${p.y}`));
  return {
    spawns,
    width: map.width,
    height: map.height,
    // Upstream marks spawn points walkable even on furniture (markWalkableSpawnPoints).
    isWalkable: (x: number, y: number) =>
      x >= 0 && y >= 0 && x < map.width && y < map.height && (col[y * map.width + x] === 0 || walk.has(`${x},${y}`)),
  };
}

const depts = (sizes: number[]) => sizes.map((n, i) => ({ name: `d${i}`, agentIds: Array.from({ length: n }, (_, k) => `a${i}-${k}`) }));

const palettes: { name: string; make: () => Palette; needsArt: boolean }[] = [
  { name: "limezu", make: () => limezuPalette(JSON.parse(readFileSync(TEMPLATE, "utf8")) as TiledMapJson), needsArt: true },
  { name: "kenney", make: kenneyPalette, needsArt: false },
];

for (const { name: pal, make, needsArt } of palettes)
describe.skipIf(needsArt && !hasArt)(`generateOfficeMap (${pal})`, () => {
  const palette = needsArt && !hasArt ? (null as never) : make();

  for (const { id, spec } of LAYOUT_PRESETS)
  for (const sizes of [[1], [3, 5, 2, 4, 1], [1, 9, 7, 5], [12, 9, 7, 6, 3, 2, 1, 1], Array(12).fill(4)]) {
    it(`${id}: every seat and cafe spot is reachable from the entrance (${sizes.join(",")})`, () => {
      const g = generateOfficeMap(depts(sizes), palette, spec);
      const m = grid(g.map);
      expect(g.seatNames.length).toBe(sizes.reduce((a, b) => a + b, 0));
      const entrance = m.spawns.get("entrance")!;
      const targets = ["desk-ceo", ...g.seatNames, ...g.cafeSeatNames, "cafe-stand-coffee", "cafe-stand-vending"];
      for (const name of targets) {
        const p = m.spawns.get(name);
        expect(p, name).toBeDefined();
        expect(findPath(m, entrance, p!), name).not.toBeNull();
      }
      for (const l of g.map.layers) if (l.data) expect(l.data.length).toBe(g.map.width * g.map.height);
    });
  }

  it.each(LAYOUT_PRESETS)("$id is deterministic and keeps the template's layer and tileset set", ({ spec }) => {
    const a = generateOfficeMap(depts([3, 4]), palette, spec);
    const b = generateOfficeMap(depts([3, 4]), palette, structuredClone(spec));
    expect(JSON.stringify(a.map)).toBe(JSON.stringify(b.map));
    expect(a.map.layers.map((l) => l.name)).toEqual(["floor", "walls", "furniture-below", "furniture-above", "collision", "spawn-points", "zones"]);
    expect(a.map.tilesets).toEqual(palette.mapBase.tilesets);
  });

  it("keeps a mid-size company close to a 16:10 floor", () => {
    const { map } = generateOfficeMap(depts([9, 7, 5]), palette);
    expect(map.width / map.height).toBeGreaterThan(1.3);
    expect(map.width / map.height).toBeLessThan(1.9);
  });

  it.each(LAYOUT_PRESETS)("$id paints the palette monitor above every desk seat", ({ spec }) => {
    const g = generateOfficeMap(depts([5, 9]), palette, spec);
    const above = g.map.layers.find((l) => l.name === "furniture-above")!.data!;
    const m = grid(g.map);
    for (const n of g.seatNames) {
      const p = m.spawns.get(n)!;
      expect(above[(p.y - (palette.monitorRow ?? 2)) * g.map.width + p.x]).toBe(palette.monitorGid);
    }
  });
});

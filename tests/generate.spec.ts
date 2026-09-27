import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPath } from "../vendor/munder-difflin/src/renderer/src/scene/office/pathfinding.js";
import { generateOfficeMap, type TiledMapJson } from "../src/layout/generate.js";

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

describe.skipIf(!hasArt)("generateOfficeMap", () => {
  const template = hasArt ? (JSON.parse(readFileSync(TEMPLATE, "utf8")) as TiledMapJson) : (null as never);

  for (const sizes of [[1], [3, 5, 2, 4, 1], [12, 9, 7, 6, 3, 2, 1, 1], Array(12).fill(4)]) {
    it(`every seat and cafe spot is reachable from the entrance (${sizes.join(",")})`, () => {
      const g = generateOfficeMap(depts(sizes), template);
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

  it("is deterministic and keeps the template's layer and tileset set", () => {
    const a = generateOfficeMap(depts([3, 4]), template);
    const b = generateOfficeMap(depts([3, 4]), template);
    expect(JSON.stringify(a.map)).toBe(JSON.stringify(b.map));
    expect(a.map.layers.map((l) => l.name)).toEqual(template.layers.map((l) => l.name));
    expect(a.map.tilesets).toEqual(template.tilesets);
  });

  it("keeps a mid-size company close to a 16:10 floor", () => {
    const { map } = generateOfficeMap(depts([9, 7, 5]), template);
    expect(map.width / map.height).toBeGreaterThan(1.3);
    expect(map.width / map.height).toBeLessThan(1.9);
  });

  it("paints the office monitor stamp two rows above every desk seat", () => {
    const g = generateOfficeMap(depts([5]), template);
    const above = g.map.layers.find((l) => l.name === "furniture-above")!.data!;
    const m = grid(g.map);
    for (const n of g.seatNames) {
      const p = m.spawns.get(n)!;
      expect(above[(p.y - 2) * g.map.width + p.x]).toBe(365);
    }
  });
});

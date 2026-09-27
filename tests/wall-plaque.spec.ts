import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findPlaqueTile } from "../src/ui/wallPlaque.js";

const MAP = "assets/local/maps/office.tmj";

describe.skipIf(!existsSync(MAP))("findPlaqueTile", () => {
  it("hangs the plaque on bare top wall in the office map", () => {
    const map = JSON.parse(readFileSync(MAP, "utf8"));
    const spot = findPlaqueTile(map)!;
    expect(spot.y).toBe(1);
    expect(spot.x).toBeGreaterThanOrEqual(18);
    expect(spot.x + 3).toBeLessThanOrEqual(31);
  });

  it("returns null when no wall run is wide enough", () => {
    const map = { width: 4, tilewidth: 16, layers: [{ name: "walls", data: new Array(12).fill(0) }] };
    expect(findPlaqueTile(map)).toBeNull();
  });
});

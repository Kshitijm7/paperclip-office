import { describe, expect, it } from "vitest";
import { assignSeats, resolveSeatTiles } from "../src/layout/seatAssignment.js";

describe("resolveSeatTiles", () => {
  it("resolves primary seats by name, then boardroom overflow, deduped", () => {
    const spawnPoints = new Map([
      ["desk-ceo", { x: 0, y: 0 }],
      ["desk-1", { x: 2, y: 0 }],
      ["desk-2", { x: 3, y: 0 }],
    ]);
    const boardroom = { x: 2, y: 1, width: 2, height: 1 };
    const walkable = (x: number, y: number) => y === 1 && (x === 2 || x === 3);
    const seats = resolveSeatTiles(["desk-ceo", "desk-1", "desk-2"], spawnPoints, boardroom, walkable);
    expect(seats).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
  });

  it("skips missing spawn points and empty boardroom zone", () => {
    const seats = resolveSeatTiles(["desk-1", "missing"], new Map([["desk-1", { x: 5, y: 5 }]]), undefined, () => false);
    expect(seats).toEqual([{ x: 5, y: 5 }]);
  });
});

describe("assignSeats", () => {
  const seatTiles = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];

  it("seats the chief at seat 0 regardless of position", () => {
    const out = assignSeats(seatTiles, [
      { id: "chief", isChief: true },
      { id: "a", isChief: false },
      { id: "b", isChief: false },
    ]);
    expect(out.get("chief")).toEqual({ x: 0, y: 0 });
    expect(out.get("a")).toEqual({ x: 1, y: 0 });
    expect(out.get("b")).toEqual({ x: 2, y: 0 });
  });

  it("leaves an agent unseated once seats run out", () => {
    const out = assignSeats([{ x: 0, y: 0 }], [
      { id: "chief", isChief: true },
      { id: "a", isChief: false },
    ]);
    expect(out.get("chief")).toEqual({ x: 0, y: 0 });
    expect(out.has("a")).toBe(false);
  });

  it("is deterministic for a given agent order", () => {
    const agents = [
      { id: "chief", isChief: true },
      { id: "a", isChief: false },
      { id: "b", isChief: false },
    ];
    expect(assignSeats(seatTiles, agents)).toEqual(assignSeats(seatTiles, agents));
  });
});

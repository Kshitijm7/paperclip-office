export interface Tile {
  x: number;
  y: number;
}

export interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Mirrors upstream OfficeFloor's seatTiles build: primary named seats first, then walkable
 *  boardroom-zone tiles as overflow, de-duplicated by tile coordinate. */
export function resolveSeatTiles(
  primarySeatNames: string[],
  spawnPoints: Map<string, Tile>,
  boardroomZone: ZoneRect | undefined,
  isWalkable: (x: number, y: number) => boolean,
): Tile[] {
  const seatTiles: Tile[] = [];
  const seen = new Set<string>();
  const add = (t?: Tile) => {
    if (!t) return;
    const k = `${t.x},${t.y}`;
    if (seen.has(k)) return;
    seen.add(k);
    seatTiles.push(t);
  };
  for (const name of primarySeatNames) add(spawnPoints.get(name));
  if (boardroomZone) {
    for (let y = boardroomZone.y; y < boardroomZone.y + boardroomZone.height; y++) {
      for (let x = boardroomZone.x; x < boardroomZone.x + boardroomZone.width; x++) {
        if (isWalkable(x, y)) add({ x, y });
      }
    }
  }
  return seatTiles;
}

/** Mirrors upstream OfficeFloor's claimSeat: the chief always takes seat 0 (desk-ceo); every
 *  other agent claims the first unclaimed seat from index 1, in store-array order. */
export function assignSeats(seatTiles: Tile[], agents: { id: string; isChief: boolean }[]): Map<string, Tile> {
  const claimed = new Set<number>();
  const out = new Map<string, Tile>();
  for (const a of agents) {
    if (a.isChief) {
      claimed.add(0);
      if (seatTiles[0]) out.set(a.id, seatTiles[0]);
      continue;
    }
    for (let i = 1; i < seatTiles.length; i++) {
      if (!claimed.has(i)) {
        claimed.add(i);
        out.set(a.id, seatTiles[i]);
        break;
      }
    }
  }
  return out;
}

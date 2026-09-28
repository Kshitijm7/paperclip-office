import type { Palette, RoomStamp, Stamp, TiledMapJson } from "./generate.js";

// CC0 Kenney art (assets/free/kenney/packed, made by scripts/pack-kenney.py). Two atlases in one gid space:
// Roguelike/RPG Pack at firstgid 1 (57 x 31 tiles), Roguelike Indoors at firstgid 1768 (27 x 18 tiles).
export const KENNEY_TILESETS = [
  { firstgid: 1, name: "kenney-rpg", image: "rpg.png", imagewidth: 912, imageheight: 496, tilewidth: 16, tileheight: 16, columns: 57, tilecount: 1767, margin: 0, spacing: 0 },
  { firstgid: 1768, name: "kenney-indoors", image: "indoors.png", imagewidth: 432, imageheight: 288, tilewidth: 16, tileheight: 16, columns: 27, tilecount: 486, margin: 0, spacing: 0 },
] as const;
const IN = 1767;
const RPG_COLS = 57;

/** Every Kenney gid the free theme draws, by name. Mirrored in assets/catalogue.json. */
export const KENNEY_GIDS = {
  // RPG sheet, beige building blocks (cols 18-24, rows 12-24): plain wall top, panelled face, lower face.
  wallTop: 1273, wallFace: 874, wallBase: 931,
  // RPG sheet, textured floors (cols 5-9, rows 2-5): brick, grey stone, beige stone, wood planks (2x2), large paving (5x2).
  floorBrick: 120, floorStone: 121, floorSand: 122, floorPlank: 123, floorPaving: 234,
  // RPG sheet, one-row mats (rows 25, cols 0-14): tan, grey, beige, green, orange, teal; and the white-edged tan runner.
  matTan: 1426, matGrey: 1429, matBeige: 1432, matGreen: 1435, matOrange: 1438, matTeal: 1441,
  runner: 1453,
  // RPG sheet: small square window (col 42, row 1), bookshelf top/bottom (cols 43-44, rows 13-14), jug, crate, clock, bin.
  window: 100,
  shelfTL: 785, shelfTR: 786, shelfBL: 842, shelfBR: 843,
  cooler: 1011, crate: 1017, clock: 483, bin: 25,
  // RPG sheet: long table with legs (cols 21-23, row 6), bench (cols 27-28, row 4), drawer cabinet (col 24, row 5),
  // low bookcases used as pod partitions (cols 42-43, row 12 and cols 41-42, row 14).
  deskL: 363, deskM: 364, deskR: 365, benchL: 255, benchR: 256, drawers: 309,
  lowShelf: [726, 727, 841],
  // Indoors sheet: oval table (row 0, cols 3-4), square table (row 2, col 4).
  ovalL: IN + 4, ovalR: IN + 5, squareTable: IN + 59,
  // Indoors sheet: chair seen from the front and from behind (col 0-1, row 2); potted plants (cols 16-17, row 0).
  chairFront: IN + 55, chairBack: IN + 56,
  plant: IN + 17, plant2: IN + 18,
  // Indoors sheet: blue-screen terminal used as the desk computer (col 22, row 4).
  computer: IN + 130,
  // Indoors sheet: kitchen counter pieces (row 12, cols 0-2 and 5); fridge (col 11, row 15).
  counter: [IN + 325, IN + 326, IN + 327, IN + 330],
  fridge: IN + 417,
  // Indoors sheet: framed pictures and maps (cols 17-20, rows 12-13), hung as wall boards.
  pictures: [[IN + 344], [IN + 345, IN + 346], [IN + 371], [IN + 372, IN + 373]],
} as const;

const K = KENNEY_GIDS;
const one = (g: number): Stamp => ({ below: [[g]], solid: [[1]] });
const row = (w: number, v = 0) => new Array<number>(w).fill(v);
const mat = (g: number) => [g, g + 1, g + 2];

/** Tile patterns per floor base gid; floorTile repeats them across the room. */
const FLOOR_PATTERNS: Record<number, number[][]> = {
  [K.floorBrick]: [[K.floorBrick], [K.floorBrick + RPG_COLS]],
  [K.floorStone]: [[K.floorStone], [K.floorStone + RPG_COLS]],
  [K.floorSand]: [[K.floorSand], [K.floorSand + RPG_COLS]],
  [K.floorPlank]: [[K.floorPlank, K.floorPlank + 1], [K.floorPlank + RPG_COLS, K.floorPlank + RPG_COLS + 1]],
  [K.floorPaving]: [[234, 235, 236, 237, 238], [291, 292, 293, 294, 295]],
};

/** Builds a room stamp from rows of [below, above, solid] per cell; `_` means empty floor. */
function room(w: number, wallRows: number, cells: Record<string, [number, number, 0 | 1]>, plan: string[]): RoomStamp {
  const st: RoomStamp = { wallRows, below: [], above: [], solid: [] };
  for (const line of plan) {
    const b = row(w), a = row(w), s = row(w);
    [...line].forEach((ch, c) => { const cell = cells[ch]; if (cell) [b[c], a[c], s[c]] = cell; });
    st.below.push(b); st.above.push(a); st.solid.push(s);
  }
  return st;
}

const CELLS: Record<string, [number, number, 0 | 1]> = {
  "[": [K.deskL, 0, 1], "=": [K.deskM, 0, 1], "]": [K.deskR, 0, 1],
  "M": [K.deskM, K.computer, 1], "Q": [K.squareTable, K.computer, 1], "D": [K.drawers, 0, 1],
  "x": [K.lowShelf[0], 0, 1], "y": [K.lowShelf[1], 0, 1], "z": [K.lowShelf[2], 0, 1],
  "v": [K.chairFront, 0, 0], "^": [K.chairBack, 0, 0], "h": [K.chairBack, 0, 1],
  "p": [K.plant, 0, 1], "q": [K.plant2, 0, 1],
  "o": [K.ovalL, 0, 1], "O": [K.ovalR, 0, 1],
  "c": [K.cooler, 0, 1], "f": [K.fridge, 0, 1], "b": [K.bin, 0, 1], "t": [K.counter[1], 0, 1],
  "s": [K.shelfBL, K.shelfTL, 1],
  "W": [0, K.window, 0], "k": [0, K.clock, 0], "P": [0, K.pictures[0][0], 0], "R": [0, K.pictures[2][0], 0],
  "1": [K.counter[0], 0, 1], "2": [K.counter[1], 0, 1], "3": [K.counter[2], 0, 1], "4": [K.counter[3], 0, 1],
};

// Room plans keep office.tmj's geometry, so the theme's seat, coffee and errand anchors land on matching props.
const ROOMS = {
  // desk-ceo sits at interior (2,1) behind the terminal; window at wall column 1 (smoke errand), clock column 0,
  // calendar picture column 3, plant at (5,0) for the water errand. The generator adds the meeting table (decor.sofa) below.
  ceo: room(6, 2, CELLS, ["kW_P__", "______", "s_QD_p", "s_h___", "_____s", "q____s", "______"]),
  // Meeting table with chairs on both sides; cooler at (7,1) for the dispenser errand, plant at (8,0).
  boardroom: room(9, 2, CELLS, ["_W__R_W__", "_________", "s_ss____p", "_______c_", "__vvvvv__", "__[===]__", "__^^^^^_q"]),
  // Canteen: seats round the oval table at (2..3, 2/4), tray on the side counter (4,3), a second table, the counter
  // row with the sink at (3,6), the fridge at (4,6) and a shelf at (5,6), plant (6,8) for the water errand.
  cafe: room(8, 2, CELLS, ["_W_P__W_", "________", "p_____cq", "________", "__vv_vv_", "__oOt[]_", "__^^_^^b", "________", "1234fs__", "________", "p_____q_"]),
};

// Partition shelf at the back, one coherent table with the terminal centred over the seat, chair in front, then aisle.
const DESK = room(3, 0, CELLS, ["xyz", "[M]", "_h_", "___"]);

export function kenneyPalette(): Palette {
  const base: TiledMapJson = {
    type: "map", version: "1.10", tiledversion: "1.10.2", orientation: "orthogonal", renderorder: "right-down", infinite: false,
    width: 0, height: 0, tilewidth: 16, tileheight: 16, nextlayerid: 8, nextobjectid: 1,
    layers: [], tilesets: KENNEY_TILESETS.map((t) => ({ ...t })),
  };
  const wall = K.wallTop;
  return {
    id: "kenney",
    mapBase: base,
    walls: {
      wallTop: wall, wallFace: K.wallFace, wallBase: K.wallBase,
      cornerTL: wall, cornerTR: wall, sideL: wall, sideR: wall,
      bottom: wall, cornerBL: wall, cornerBR: wall, vwallCap: wall, vwall: wall,
    },
    // Neutral textured floors; department colour only shows in the mats.
    floors: { hall: K.floorStone, ceo: K.floorBrick, boardroom: K.floorPlank, break: K.floorSand, filler: K.floorStone, depts: [K.floorPlank, K.floorBrick] },
    floorTile: (g, x, y) => {
      const p = FLOOR_PATTERNS[g];
      if (!p) return g;
      const r = p[y % p.length];
      return r[x % r.length];
    },
    decor: {
      bookshelf: { below: [[K.shelfBL, K.shelfBR]], above: [[K.shelfTL, K.shelfTR]], solid: [[1, 1]] },
      sofa: { below: [[K.ovalL, K.ovalR, K.plant2], [K.chairBack, K.chairBack, K.chairBack]], solid: [[1, 1, 1], [0, 0, 0]] },
      plant: one(K.plant),
      plant2: one(K.plant2),
      cooler: one(K.cooler),
      boxes: one(K.crate),
      reception: { below: [[0, 0, 0], [K.deskL, K.deskM, K.deskR], [0, K.chairBack, 0]], above: [[0, 0, 0], [0, K.computer, 0], [0, 0, 0]], solid: [[0, 0, 0], [1, 1, 1], [0, 0, 0]] },
    },
    boards: K.pictures.map((p) => [[...p]]),
    window: [[K.window]],
    monitorGid: K.computer,
    monitorRow: 1,
    rooms: ROOMS,
    desk: DESK,
    geometry: { outerWallRows: 3, wallRows: 2, maxCorridor: 2, maxSpine: 4, decor: 2 },
    mats: [mat(K.matGreen), mat(K.matOrange), mat(K.matTeal), mat(K.matBeige), mat(K.matTan)],
    runner: [K.floorSand, K.floorSand, K.floorSand],
    hallDecor: [one(K.plant), { below: [[K.benchL, K.benchR]], solid: [[1, 1]] }, one(K.cooler), one(K.plant2), one(K.bin)],
  };
}

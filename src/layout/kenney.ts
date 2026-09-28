import type { Palette, RoomStamp, Stamp, TiledMapJson } from "./generate.js";

// CC0 Kenney art (assets/free/kenney/packed, made by scripts/pack-kenney.py). Two atlases in one gid space:
// Roguelike/RPG Pack at firstgid 1 (57 x 31 tiles), Roguelike Indoors at firstgid 1768 (27 x 18 tiles).
export const KENNEY_TILESETS = [
  { firstgid: 1, name: "kenney-rpg", image: "rpg.png", imagewidth: 912, imageheight: 496, tilewidth: 16, tileheight: 16, columns: 57, tilecount: 1767, margin: 0, spacing: 0 },
  { firstgid: 1768, name: "kenney-indoors", image: "indoors.png", imagewidth: 432, imageheight: 288, tilewidth: 16, tileheight: 16, columns: 27, tilecount: 486, margin: 0, spacing: 0 },
] as const;
const IN = 1767;

/** Every Kenney gid the free theme draws, by name. Mirrored in assets/catalogue.json. */
export const KENNEY_GIDS = {
  // RPG sheet, beige building blocks (cols 18-24, rows 12-24): plain wall top, panelled face, lower face.
  wallTop: 1273, wallFace: 874, wallBase: 931,
  // RPG sheet, interior floor 9-slices (rows 25-26): centre tiles.
  floorWood: 1484, floorGrey: 1487, floorBeige: 1490, carpetGreen: 1493, carpetOrange: 1496, carpetTeal: 1499,
  // RPG sheet: wooden window (col 42, rows 0-1), bookshelf top/bottom (cols 43-44, rows 13-14), jug, crate, clock, bin.
  windowTop: 43, windowBottom: 100,
  shelfTL: 785, shelfTR: 786, shelfBL: 842, shelfBR: 843,
  cooler: 1011, crate: 1017, clock: 483, bin: 25,
  // Indoors sheet: table top row (cols 0-2, row 0) and front row (row 1), oval table (row 0, cols 3-4).
  tableL: IN + 1, tableM: IN + 2, tableR: IN + 3, tableFrontL: IN + 28, tableFrontM: IN + 29, tableFrontR: IN + 30,
  ovalL: IN + 4, ovalR: IN + 5,
  // Indoors sheet: chair seen from the front and from behind (col 0-1, row 2); potted plants (cols 16-17, row 0).
  chairFront: IN + 55, chairBack: IN + 56,
  plant: IN + 17, plant2: IN + 18,
  // Indoors sheet: blue-screen terminal used as the desk computer (col 22, row 4).
  computer: IN + 130,
  // Indoors sheet: kitchen counter, top and front rows (row 12-13, cols 0-5); fridge (col 11, row 15).
  counterTop: [IN + 325, IN + 326, IN + 327, IN + 330, IN + 331],
  counterFront: [IN + 352, IN + 353, IN + 354, IN + 357, IN + 358],
  counterSingle: IN + 380,
  fridge: IN + 417,
  // Indoors sheet: framed pictures and maps (cols 17-20, rows 12-13), hung as wall boards.
  pictures: [[IN + 344], [IN + 345, IN + 346], [IN + 371], [IN + 372, IN + 373]],
} as const;

const K = KENNEY_GIDS;
const one = (g: number): Stamp => ({ below: [[g]], solid: [[1]] });
const row = (w: number, v = 0) => new Array<number>(w).fill(v);

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
  "[": [K.tableL, 0, 1], "=": [K.tableM, 0, 1], "]": [K.tableR, 0, 1],
  "{": [K.tableFrontL, 0, 1], "-": [K.tableFrontM, 0, 1], "}": [K.tableFrontR, 0, 1],
  "M": [K.tableM, K.computer, 1], "L": [K.tableL, K.computer, 1],
  "v": [K.chairFront, 0, 0], "^": [K.chairBack, 0, 0], "h": [K.chairBack, 0, 1],
  "p": [K.plant, 0, 1], "q": [K.plant2, 0, 1],
  "o": [K.ovalL, 0, 1], "O": [K.ovalR, 0, 1],
  "c": [K.cooler, 0, 1], "f": [K.fridge, 0, 1], "t": [K.counterSingle, 0, 1], "b": [K.bin, 0, 1],
  "s": [K.shelfBL, K.shelfTL, 1],
  "W": [0, K.windowTop, 0], "w": [0, K.windowBottom, 0], "k": [0, K.clock, 0], "P": [0, K.pictures[0][0], 0],
  "1": [K.counterTop[0], 0, 1], "2": [K.counterTop[1], 0, 1], "3": [K.counterTop[2], 0, 1], "4": [K.counterTop[3], 0, 1], "5": [K.counterTop[4], 0, 1],
  "6": [K.counterFront[0], 0, 1], "7": [K.counterFront[1], 0, 1], "8": [K.counterFront[2], 0, 1], "9": [K.counterFront[3], 0, 1], "0": [K.counterFront[4], 0, 1],
};

// Room plans keep office.tmj's geometry, so the theme's seat, coffee and errand anchors land on matching props.
const ROOMS = {
  // desk-ceo sits at interior (2,1); window at wall column 1 (smoke errand), clock column 0, picture column 3.
  ceo: room(6, 2, CELLS, ["kW_P__", "_w____", "__L=]p", "__h___", "______", "______", "______"]),
  // Meeting table with chairs on both sides; cooler at (7,1) for the dispenser errand, plant at (8,0).
  boardroom: room(9, 2, CELLS, ["_W___W___", "_w___w___", "________p", "__vvvvvc_", "__[===]__", "__{---}__", "__^^^^^__"]),
  // Cafe: seats round the oval table at (2..3, 2/4), tray on the side counter (4,3), counter rows 6-7, plant (6,8).
  cafe: room(8, 2, CELLS, ["_W____W_", "_w____w_", "p___f__c", "________", "__vv____", "__oOt___", "__^^___b", "________", "12345s__", "67890___", "______q_"]),
};

const DESK = room(3, 0, CELLS, ["[M]", "{-}", "_h_", "___"]);

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
    // The hall is grey so the beige wall tops read as walls against it.
    floors: { hall: K.floorGrey, ceo: K.floorWood, boardroom: K.carpetTeal, break: K.floorWood, filler: K.floorGrey, depts: [K.carpetGreen, K.carpetOrange, K.carpetTeal, K.floorWood] },
    floorTile: (g) => g,
    decor: {
      bookshelf: { below: [[K.shelfBL, K.shelfBR]], above: [[K.shelfTL, K.shelfTR]], solid: [[1, 1]] },
      sofa: { below: [[K.tableL, K.tableM, K.tableR], [K.chairBack, K.chairBack, K.chairBack]], solid: [[1, 1, 1], [0, 0, 0]] },
      plant: one(K.plant),
      plant2: one(K.plant2),
      cooler: one(K.cooler),
      boxes: one(K.crate),
      reception: { below: [[0, 0, 0], [K.tableL, K.tableM, K.tableR], [K.tableFrontL, K.tableFrontM, K.tableFrontR]], above: [[0, 0, 0], [0, K.computer, 0], [0, 0, 0]], solid: [[0, 0, 0], [1, 1, 1], [1, 1, 1]] },
    },
    boards: K.pictures.map((p) => [[...p]]),
    window: [[K.windowTop], [K.windowBottom]],
    monitorGid: K.computer,
    rooms: ROOMS,
    desk: DESK,
  };
}

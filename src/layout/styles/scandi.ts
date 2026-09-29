import type { Palette, RoomStamp, Stamp, TiledMapJson } from "../generate.js";
import { ATLAS } from "./scandi.atlas.js";

type Name = keyof typeof ATLAS.objects;
type Solid = "all" | "base" | "none";

/** Tile gids of a named object from the v2 sheets (firstgid 1; -1 in the atlas means empty). */
const obj = (n: Name): number[][] => (ATLAS.objects[n] as readonly (readonly number[])[]).map((r) => r.map((i) => (i < 0 ? 0 : i + 1)));

export const SCANDI_TILESET = {
  firstgid: 1, name: "scandi", image: "atlas.png", imagewidth: ATLAS.columns * 16, imageheight: ATLAS.rows * 16,
  tilewidth: 16, tileheight: 16, columns: ATLAS.columns, tilecount: ATLAS.columns * ATLAS.rows, margin: 0, spacing: 0,
};

function stamp(n: Name, solid: Solid = "all"): Stamp {
  const g = obj(n);
  const tall = solid === "base";
  return {
    below: g.map((r, y) => r.map((v) => (tall && y < g.length - 1 ? 0 : v))),
    above: g.map((r, y) => r.map((v) => (tall && y < g.length - 1 ? v : 0))),
    solid: g.map((r, y) => r.map((v) => (solid === "all" || (tall && y === g.length - 1) ? (v ? 1 : 0) : 0))),
  };
}

/** A room grid; objects are placed by name, rows before `wallRows` hang on the wall and never block. */
function room(w: number, rows: number, wallRows: number, place: (put: (n: Name, x: number, y: number, solid?: Solid, skipTop?: number) => void) => void): RoomStamp {
  const grid = () => Array.from({ length: rows }, () => new Array<number>(w).fill(0));
  const st: RoomStamp = { wallRows, below: grid(), above: grid(), solid: grid() };
  place((n, x, y, solid = "all", skipTop = 0) => {
    obj(n).slice(skipTop).forEach((r, dy) => r.forEach((v, dx) => {
      const yy = y + dy, xx = x + dx;
      if (!v || yy >= rows || xx >= w) return;
      const onWall = yy < wallRows;
      const layer = onWall || (solid === "base" && dy < obj(n).length - skipTop - 1) ? st.above : st.below;
      layer[yy][xx] = v;
      if (!onWall) st.solid[yy][xx] = solid === "all" || (solid === "base" && dy === obj(n).length - skipTop - 1) ? 1 : 0;
    }));
  });
  return st;
}

// Room plans keep office.tmj's geometry (the cells the anchor tests check), so seat, coffee and errand anchors hold.
const ROOMS = {
  ceo: room(6, 7, 2, (put) => {
    put("clock", 0, 0, "none"); put("calendar", 3, 0, "none"); put("art_landscape", 4, 0, "none");
    put("exec_off", 1, 1); put("chair_up_mustard", 2, 3); put("filing", 0, 2);
    put("fig", 5, 1, "base"); put("monstera", 0, 4, "base"); put("coatrack", 5, 4, "base");
  }),
  boardroom: room(9, 7, 2, (put) => {
    put("window", 1, 0, "none", 1); put("screen_bars", 3, 0, "none"); put("window", 6, 0, "none", 1);
    put("plant_small", 0, 2); put("bookshelf", 2, 1); put("plant_small", 8, 2); put("cooler", 7, 2, "base");
    for (let x = 2; x <= 6; x++) { put("chair_down", x, 3, "none"); put("meeting_chair_1", x, 6, "none"); }
    put("meeting_table", 2, 4, "base"); put("monstera", 8, 5, "base");
  }),
  cafe: room(8, 11, 2, (put) => {
    put("window", 1, 0, "none", 1); put("art_abstract", 3, 0, "none"); put("window", 6, 0, "none", 1);
    put("plant_small", 0, 2); put("cooler", 6, 1, "base"); put("fig", 7, 1, "base");
    for (const x of [2, 3, 5, 6]) { put("chair_down", x, 4, "none"); put("chair_up_sage", x, 6, "none"); }
    put("cafe_table_row", 2, 5); put("counter", 4, 4, "base"); put("cafe_table_row", 5, 5); put("bin", 7, 6);
    put("counter_l", 0, 7, "base"); put("counter_micro", 1, 7, "base"); put("counter_coffee", 2, 7, "base"); put("counter_sink", 3, 7, "base");
    put("fridge", 4, 7, "base"); put("vending", 5, 7, "base");
    put("plant_small", 0, 10); put("fig", 6, 9, "base");
  }),
};

// DESK_BLOCK (3 x 4, seat at 1,2): the desk's top row carries the monitor two rows above the seat, then the chair, then the aisle.
const DESK = room(3, 4, 0, (put) => { put("desk_off", 0, 0); put("chair_up_sage", 1, 2); });
DESK.above[0] = [...DESK.below[0]];

export const SCANDI_MONITOR_GID = obj("desk_off")[0][1];
/** DeskScreen overlay: the whole lit desk drawn over the dark one, relative to the monitor tile (seat.x, seat.y - 2). */
export const SCANDI_MONITOR_ON: [number, number, number][] = obj("desk_on").flatMap((r, dy) => r.map((g, dx) => [g, dx - 1, dy] as [number, number, number]));

const patterns = new Map<number, number[][]>();
const floor = (n: Name) => { const g = obj(n); patterns.set(g[0][0], g); return g[0][0]; };

export function scandiPalette(): Palette {
  const wall = obj("wall"), vwall = obj("vwall");
  const base: TiledMapJson = {
    type: "map", version: "1.10", tiledversion: "1.10.2", orientation: "orthogonal", renderorder: "right-down", infinite: false,
    width: 0, height: 0, tilewidth: 16, tileheight: 16, nextlayerid: 8, nextobjectid: 1,
    layers: [], tilesets: [{ ...SCANDI_TILESET }],
  };
  const floors = {
    hall: floor("floor_stone"), ceo: floor("floor_wood"), boardroom: floor("floor_sage"), break: floor("floor_terrazzo"), filler: floor("floor_wood"),
    depts: [floor("floor_wood"), floor("floor_pink"), floor("floor_blue"), floor("floor_mustard"), floor("floor_sage2")],
  };
  const tall = (n: Name) => stamp(n, "base");
  return {
    id: "scandi",
    mapBase: base,
    walls: {
      wallTop: wall[0][0], wallFace: wall[1][0], wallBase: wall[2][0],
      cornerTL: vwall[0][0], cornerTR: vwall[0][0], sideL: vwall[1][0], sideR: vwall[1][0],
      bottom: wall[0][0], cornerBL: wall[0][0], cornerBR: wall[0][0], vwallCap: vwall[0][0], vwall: vwall[1][0],
    },
    floors,
    floorTile: (g, x, y) => {
      const p = patterns.get(g);
      if (!p) return g;
      const r = p[y % p.length];
      return r[x % r.length];
    },
    decor: {
      bookshelf: stamp("bookshelf"),
      sofa: { ...stamp("sofa"), solid: [[1, 1, 1], [0, 0, 0]] },
      plant: tall("fig"),
      plant2: tall("monstera"),
      cooler: tall("cooler"),
      boxes: stamp("planter"),
      reception: { below: [[0, 0, 0], ...obj("reception3")], above: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], solid: [[0, 0, 0], [1, 1, 1], [1, 1, 1]] },
    },
    boards: (["kanban", "whiteboard", "notice", "askme", "screen_bars", "screen_line", "screen_list", "art_abstract", "art_landscape", "photo"] as Name[]).map(obj),
    window: obj("window").slice(1),
    monitorGid: SCANDI_MONITOR_GID,
    monitorRow: 2,
    rooms: ROOMS,
    desk: DESK,
    geometry: { outerWallRows: 3, wallRows: 3 },
    hallDecor: [tall("fig"), stamp("bench"), tall("floor_lamp"), tall("monstera"), stamp("planter")],
  };
}

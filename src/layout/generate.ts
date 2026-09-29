import { DEFAULT_SPEC, type LayoutSpec } from "./spec.js";

// Builds a Tiled map from the org chart: walled rooms on a corridor and a central spine, drawn with a swappable tile palette.

export interface TiledLayerJson {
  name: string;
  type: "tilelayer" | "objectgroup";
  width?: number;
  height?: number;
  data?: number[];
  objects?: { id: number; name: string; type: string; x: number; y: number; width: number; height: number; point?: boolean }[];
  [k: string]: unknown;
}
export interface TiledMapJson {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayerJson[];
  tilesets: unknown[];
  [k: string]: unknown;
}
export interface DepartmentInput { name: string; agentIds: string[] }
export interface Tile { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Doors are two tiles wide; wall heights come from the palette's geometry. */
const DOOR_WIDTH = 2;

const TILE_LAYERS = ["floor", "walls", "furniture-below", "furniture-above", "collision"] as const;
type LayerName = (typeof TILE_LAYERS)[number];

/** office.tmj regions: `interior` is walkable room space, `decorTop` is the first wall row whose props come along. */
export const TEMPLATE_ROOMS = {
  ceo: { interior: { x: 1, y: 3, w: 6, h: 5 }, decorTop: 1 },
  boardroom: { interior: { x: 9, y: 3, w: 9, h: 5 }, decorTop: 1 },
  cafe: { interior: { x: 25, y: 12, w: 8, h: 9 }, decorTop: 10 },
} as const;
export type TemplateRoom = keyof typeof TEMPLATE_ROOMS;
/** The pc-1 desk block: monitor two rows up, chair row, chair foot row. */
export const DESK_BLOCK = { x: 1, y: 11, w: 3, h: 4, seat: { x: 1, y: 2 } };
const DESK_ROWS = 2;
const podWidth = (podSize: number) => (podSize === 2 ? 3 : 6);

export interface Stamp { below?: number[][]; above?: number[][]; solid: number[][] }
/** A room's furniture from its first decor row down; rows before `wallRows` sit on the wall and set no collision. */
export interface RoomStamp { wallRows: number; below: number[][]; above: number[][]; solid: number[][] }
export interface WallGids {
  wallTop: number; wallFace: number; wallBase: number;
  cornerTL: number; cornerTR: number; sideL: number; sideR: number;
  bottom: number; cornerBL: number; cornerBR: number;
  vwallCap: number; vwall: number;
}
export type FloorKey = "hall" | "ceo" | "boardroom" | "break" | "filler";
/** Everything tile-specific: the generator only plans rooms and asks the palette what to draw. */
export interface Palette {
  id: string;
  /** Map fields other than size and layers (tilesets, orientation, ...). */
  mapBase: TiledMapJson;
  walls: WallGids;
  floors: Record<FloorKey, number> & { depts: number[] };
  floorTile: (base: number, x: number, y: number) => number;
  decor: Record<"bookshelf" | "sofa" | "plant" | "plant2" | "cooler" | "boxes" | "reception", Stamp>;
  boards: number[][][];
  window: number[][];
  /** Drawn on furniture-above two rows over every desk seat. */
  monitorGid: number;
  rooms: Record<TemplateRoom, RoomStamp>;
  /** DESK_BLOCK-sized desk, seat at DESK_BLOCK.seat. */
  desk: RoomStamp;
  /** Rows between the monitor and its seat (default 2). */
  monitorRow?: number;
  geometry?: Partial<PaletteGeometry>;
  /** One-row mats [left, middle, right], one per department colour (the last one for shared rooms): in each doorway and under the lead's chair. */
  mats?: number[][];
  /** One-row runner [left, middle, right] laid along corridors. */
  runner?: number[];
  /** A 3x3 rug stretched over every corridor and down the spine, so the walkways read as paths. */
  runnerRug?: number[][];
  /** A two-tile mat laid just inside every door. */
  doorMat?: number[];
  /** Props dotted along corridors and the spine. */
  hallDecor?: Stamp[];
  /** Desk chair gid for a seat on this floor tile, so chairs contrast with the room. */
  chairFor?: (floorGid: number) => number | undefined;
  /** Pieces hung between windows on the outer wall (shelves, art, clock); windows alone when absent. */
  wallKit?: number[][][];
  /** Four café seat tiles in office.tmj coordinates, when the palette's café plan moves the chairs. */
  cafeSeats?: [number, number][];
  /** Coffee and vending stand tiles (office.tmj coordinates) and the café door's offset from its left wall. */
  cafeStands?: { coffee: [number, number]; vending: [number, number]; doorOffset: number };
  /** Coffee routine anchors in office.tmj coordinates, when the café plan moves the kitchen. */
  coffee?: { trayTile: Tile; trayStand: Tile; machineStand: Tile; sinkTile: Tile; sinkStand: Tile };
  /** Props for the lounge beside the café, in placement order. */
  loungeKit?: Stamp[];
  /** A second wall board for wide department rooms (a to-do board). */
  todoBoard?: number[][];
}
export interface PaletteGeometry {
  /** Height of the outer top wall (windows hang here). */
  outerWallRows: number;
  /** Height of walls between rooms and corridors. */
  wallRows: number;
  /** Caps on the spec's corridor height and spine width. */
  maxCorridor: number;
  maxSpine: number;
  /** Multiplier on how many decor props a room gets. */
  decor: number;
}
const DEFAULT_GEOMETRY: PaletteGeometry = { outerWallRows: 3, wallRows: 3, maxCorridor: 99, maxSpine: 99, decor: 1 };
const LOUNGE_W = 6;

export interface GeneratedOffice {
  map: TiledMapJson;
  seatNames: string[];
  cafeSeatNames: string[];
  /** Offset to add to a template tile inside each stamped room. */
  offsets: Partial<Record<TemplateRoom, Tile>>;
  boards: Tile;
  entrance: Tile;
}

type Kind = "ceo" | "boardroom" | "break" | "dept" | "filler";
interface Room { kind: Kind; w: number; dept?: number; x: number; y: number; h: number; doorTop: boolean }

/** Lead desk, an aisle, then pods of four desks (two facing pairs deep) with an aisle between pods. */
/** Lead desk (3) plus a 3-tile aisle the door opens onto, before the first pod. */
const LEAD_GAP = 6;

export function deptRoomWidth(headcount: number, podSize = 4): number {
  const pods = Math.ceil(Math.max(0, headcount - 1) / podSize);
  return Math.max(5, LEAD_GAP + (pods ? pods * (podWidth(podSize) + 1) - 1 : 0));
}

/** Sort key per department index; the index itself stays the department's identity (seat names). */
function rankDepartments(departments: DepartmentInput[], cfg: LayoutSpec): number[] {
  const idx = departments.map((_, i) => i);
  if (cfg.deptOrder === "size") idx.sort((a, b) => departments[b].agentIds.length - departments[a].agentIds.length || a - b);
  if (cfg.deptOrder === "name") idx.sort((a, b) => departments[a].name.localeCompare(departments[b].name) || a - b);
  const rank = new Array<number>(departments.length);
  idx.forEach((d, r) => { rank[d] = r; });
  return rank;
}

const segWidth =(ws: number[]) => (ws.length ? ws.reduce((s, w) => s + w, 0) + ws.length - 1 : 0);

interface Plan { row0: number[]; left: number[][]; right: number[][]; inner: number; maxL: number; maxR: number }

function planRows(widths: number[], row0Base: number[], K: number, sw: number, rank: number[], maxColumns: number): Plan {
  const row0: number[] = [];
  const left = Array.from({ length: K - 1 }, () => [] as number[]);
  const right = Array.from({ length: K - 1 }, () => [] as number[]);
  const w = (ids: number[]) => segWidth(ids.map((i) => widths[i]));
  const measure = () => {
    const maxL = Math.max(0, ...left.map(w)), maxR = Math.max(0, ...right.map(w));
    const lower = (maxL ? maxL + 1 : 0) + sw + (maxR ? maxR + 1 : 0);
    return { inner: Math.max(segWidth([...row0Base, ...row0.map((i) => widths[i])]), lower), maxL, maxR };
  };
  const slots = [...left.flatMap((l, r) => [l, right[r]]), row0];
  const order = widths.map((_, i) => i).sort((a, b) => widths[b] - widths[a] || rank[a] - rank[b]);
  for (const i of order) {
    let best: number[] | null = null, bestKey = [Infinity, Infinity, Infinity];
    const open = slots.filter((s) => s.length < maxColumns);
    for (const s of open.length ? open : slots) {
      s.push(i);
      const m = measure();
      const key = [m.inner, Math.abs(m.maxL - m.maxR), w(s)];
      s.pop();
      const k = key.findIndex((v, j) => v !== bestKey[j]);
      if (k >= 0 && key[k] < bestKey[k]) { best = s; bestKey = key; }
    }
    best!.push(i);
  }
  for (const s of slots) s.sort((a, b) => rank[a] - rank[b]);
  return { row0, left, right, ...measure() };
}

/** Height of each lower band: one desk row when every department in it fits its lead and first pod row. */
function bandHeights(p: Plan, departments: DepartmentInput[], podSize: number): number[] {
  const rows = (i: number) => (departments[i].agentIds.length - 1 > podSize / 2 ? DESK_ROWS : 1);
  return p.left.map((l, r) => DESK_BLOCK.h * Math.max(1, ...[...l, ...p.right[r]].map(rows)));
}

function rowsHeight(K: number, h0: number, cor: number, geo: PaletteGeometry, bandH: number[]): number {
  const WR = geo.wallRows;
  let y = geo.outerWallRows + h0;
  for (let r = 1; r < K; r++) y += (r % 2 ? 2 * WR + cor : WR) + bandH[r - 1];
  if ((K - 1) % 2 === 0) y += WR + cor;
  return y + 1;
}

export function generateOfficeMap(
  departments: DepartmentInput[],
  palette: Palette,
  cfg: LayoutSpec = DEFAULT_SPEC,
): GeneratedOffice {
  const geo = { ...DEFAULT_GEOMETRY, ...palette.geometry };
  const WALL_ROWS = geo.wallRows, OUTER = geo.outerWallRows;
  const sw = Math.min(cfg.spineWidth, geo.maxSpine);
  const cor = Math.min(cfg.corridor, geo.maxCorridor);
  const breakW = TEMPLATE_ROOMS.cafe.interior.w + (cfg.lounge ? LOUNGE_W : 0);
  const band = cfg.topBand.filter((t) => t !== "boardroom" || cfg.boardroom);
  const specials = band.filter((t): t is "ceo" | "boardroom" | "break" => t !== "departments");
  const specialW = { ceo: TEMPLATE_ROOMS.ceo.interior.w, boardroom: TEMPLATE_ROOMS.boardroom.interior.w, break: breakW } as Record<Kind, number>;
  const widths = departments.map((d) => deptRoomWidth(d.agentIds.length, cfg.podSize));
  const rank = rankDepartments(departments, cfg);
  const h0 = Math.max(TEMPLATE_ROOMS.cafe.interior.h, DESK_ROWS * DESK_BLOCK.h);

  let plan: Plan | null = null, K = 2, bestScore = Infinity;
  for (let k = 2; k <= cfg.maxRows; k++) {
    const p = planRows(widths, specials.map((s) => specialW[s]), k, sw, rank, cfg.maxColumns);
    const score = Math.abs(Math.log((p.inner + 2) / rowsHeight(k, h0, cor, geo, bandHeights(p, departments, cfg.podSize)) / cfg.aspect));
    if (score < bestScore - 1e-9) { plan = p; K = k; bestScore = score; }
  }
  const P = plan!;
  const W = P.inner + 2;
  const bandH = [h0, ...bandHeights(P, departments, cfg.podSize)];
  const H = rowsHeight(K, h0, cor, geo, bandH.slice(1));
  const sx = P.maxL ? P.maxL + 2 : 1;
  const rightStart = sx + sw + 1;

  const L = Object.fromEntries(TILE_LAYERS.map((n) => [n, new Array<number>(W * H).fill(0)])) as Record<LayerName, number[]>;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (layer: LayerName, x: number, y: number, g: number) => { if (inside(x, y)) L[layer][y * W + x] = g; };
  const get = (layer: LayerName, x: number, y: number) => (inside(x, y) ? L[layer][y * W + x] : 1);
  const { walls: G, floors: FLOOR, decor: DECOR, boards: BOARDS, window: WINDOW } = palette;
  const floor = (r: Rect, base: number) => {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) set("floor", x, y, palette.floorTile(base, x, y));
  };

  // Vertical plan: row tops, the horizontal walls (with which rows door through them) and corridors.
  const rowTop: number[] = [OUTER];
  const hwalls: { y: number; spineCut: boolean }[] = [];
  const corridors: number[] = [];
  let y = OUTER + h0;
  for (let r = 1; r < K; r++) {
    if (r % 2) {
      hwalls.push({ y, spineCut: false });
      corridors.push(y + WALL_ROWS);
      y += WALL_ROWS + cor;
      hwalls.push({ y, spineCut: true });
      y += WALL_ROWS;
    } else {
      hwalls.push({ y, spineCut: true });
      y += WALL_ROWS;
    }
    rowTop.push(y);
    y += bandH[r];
  }
  if ((K - 1) % 2 === 0) { hwalls.push({ y, spineCut: true }); corridors.push(y + WALL_ROWS); }
  const spineTop = corridors[0];
  const inSpine = (x: number) => x >= sx && x < sx + sw;

  // Rooms, stretched so every row fills the building width.
  const rooms: Room[] = [];
  const stretch = (list: Room[], width: number) => {
    let extra = width - segWidth(list.map((r) => r.w));
    const pref = list.filter((r) => r.kind === "dept");
    const takers = pref.length ? pref : list.filter((r) => r.kind === "break").concat(list.filter((r) => r.kind !== "break"));
    for (let i = 0; extra > 0; i++, extra--) takers[i % takers.length].w++;
  };
  const layRow = (list: Room[], x0: number, width: number, top: number, h: number, doorTop: boolean) => {
    if (!list.length) {
      if (width >= 4) list.push({ kind: "filler", w: width, x: 0, y: 0, h: 0, doorTop });
      else return;
    }
    stretch(list, width);
    let x = x0;
    for (const r of list) { r.x = x; r.y = top; r.h = h; r.doorTop = doorTop; rooms.push(r); x += r.w + 1; }
  };
  const deptRoom = (i: number): Room => ({ kind: "dept", w: widths[i], dept: i, x: 0, y: 0, h: 0, doorTop: false });
  layRow(band.flatMap((t): Room[] => t === "departments"
    ? P.row0.map(deptRoom)
    : [{ kind: t, w: specialW[t], x: 0, y: 0, h: 0, doorTop: false }]), 1, W - 2, rowTop[0], h0, false);
  const lowerRows: { left: Room[]; right: Room[] }[] = [];
  for (let r = 1; r < K; r++) {
    const left = P.left[r - 1].map(deptRoom), right = P.right[r - 1].map(deptRoom);
    const doorTop = r % 2 === 1;
    if (sx > 1) layRow(left, 1, sx - 2, rowTop[r], bandH[r], doorTop);
    if (rightStart <= W - 2) layRow(right, rightStart, W - 1 - rightStart, rowTop[r], bandH[r], doorTop);
    lowerRows.push({ left, right });
  }

  // Floors: hall everywhere, then each room's own swatch.
  floor({ x: 1, y: OUTER, w: W - 2, h: H - 1 - OUTER }, FLOOR.hall);
  for (const r of rooms)
    floor({ x: r.x, y: r.y, w: r.w, h: r.h }, r.kind === "dept" ? FLOOR.depts[cfg.floorPerDepartment ? r.dept! % FLOOR.depts.length : 0] : FLOOR[r.kind as "ceo"]);

  // Outer shell.
  const solid = (x: number, yy: number) => set("collision", x, yy, 1);
  for (let x = 0; x < W; x++) {
    set("walls", x, 0, x === 0 ? G.cornerTL : x === W - 1 ? G.cornerTR : G.wallTop);
    for (let r = 1; r < OUTER; r++) set("walls", x, r, x === 0 ? G.sideL : x === W - 1 ? G.sideR : r === 1 ? G.wallFace : G.wallBase);
    set("walls", x, H - 1, x === 0 ? G.cornerBL : x === W - 1 ? G.cornerBR : G.bottom);
    for (let r = 0; r < OUTER; r++) solid(x, r);
    solid(x, H - 1);
  }
  for (let yy = OUTER; yy < H - 1; yy++) {
    set("walls", 0, yy, G.sideL); set("walls", W - 1, yy, G.sideR);
    solid(0, yy); solid(W - 1, yy);
  }
  const hwallGids = [G.wallTop, G.wallFace, G.wallBase].slice(0, WALL_ROWS);
  while (hwallGids.length < WALL_ROWS) hwallGids.splice(1, 0, G.wallFace);
  // Horizontal walls (cut by the spine below the first corridor), vertical walls between rooms and along the spine.
  for (const hw of hwalls)
    for (let x = 1; x < W - 1; x++) {
      if (hw.spineCut && inSpine(x)) continue;
      hwallGids.forEach((g, r) => { set("walls", x, hw.y + r, g); solid(x, hw.y + r); });
    }
  const vwall = (x: number, top: number, h: number) => {
    for (let r = 0; r < h; r++) { set("walls", x, top + r, r === 0 ? G.vwallCap : G.vwall); solid(x, top + r); }
  };
  const openSeam = (r: Room) => !cfg.roomWalls && r.kind === "dept" && rooms.some((n) => n.kind === "dept" && n.y === r.y && n.x === r.x + r.w + 1);
  for (const r of rooms) if (r.x + r.w < W - 1 && !openSeam(r)) vwall(r.x + r.w, r.y, r.h);
  for (let r = 1; r < K; r++) {
    const { left, right } = lowerRows[r - 1];
    if (left.length) vwall(sx - 1, rowTop[r], bandH[r]);
    if (right.length) vwall(sx + sw, rowTop[r], bandH[r]);
  }
  // Hall space beside the spine that was too narrow for a room stays open floor.
  for (let r = 1; r < K; r++)
    for (let x = 1; x < W - 1; x++)
      for (let yy = rowTop[r]; yy < rowTop[r] + bandH[r]; yy++)
        if (!rooms.some((rm) => x >= rm.x && x <= rm.x + rm.w && yy >= rm.y && yy < rm.y + rm.h) && !inSpine(x) && x !== sx - 1 && x !== sx + sw) {
          set("walls", x, yy, 0); set("collision", x, yy, 0);
        }

  const spawns: { name: string; x: number; y: number }[] = [];
  const zones: { name: string; x: number; y: number; w: number; h: number }[] = [];
  const seatNames: string[] = [];
  const cafeSeatNames: string[] = [];
  const offsets = {} as Record<TemplateRoom, Tile>;
  const reserved = new Set<number>();

  // (x0, y0) is the room's first interior tile; wall rows go above it.
  const stampRoom = (st: RoomStamp, x0: number, y0: number) => {
    st.solid.forEach((row, r) => row.forEach((v, c) => {
      const x = x0 + c, yy = y0 - st.wallRows + r;
      if (st.below[r][c]) set("furniture-below", x, yy, st.below[r][c]);
      if (st.above[r][c]) set("furniture-above", x, yy, st.above[r][c]);
      if (r >= st.wallRows) set("collision", x, yy, v ? 1 : 0);
    }));
  };
  const stampDesk = (bx: number, by: number) => {
    stampRoom(palette.desk, bx, by);
    const chair = palette.chairFor?.(get("floor", bx + DESK_BLOCK.seat.x, by + DESK_BLOCK.seat.y));
    if (chair) set("furniture-below", bx + DESK_BLOCK.seat.x, by + DESK_BLOCK.seat.y, chair);
  };
  const stamp = (s: Stamp, x0: number, y0: number) => {
    s.solid.forEach((row, r) => row.forEach((v, c) => {
      const b = s.below?.[r]?.[c], a = s.above?.[r]?.[c];
      if (b) set("furniture-below", x0 + c, y0 + r, b);
      if (a) set("furniture-above", x0 + c, y0 + r, a);
      if (v) solid(x0 + c, y0 + r);
    }));
  };
  // Wall cells taken by upstream overlays (the task board), so our own wall pieces keep clear of them.
  const wallBusy = new Set<number>();
  const wallDecor = (gids: number[][], x0: number, y0: number) => {
    for (let r = 0; r < gids.length; r++) for (let c = -1; c <= gids[r].length; c++) {
      const x = x0 + c, yy = y0 + r;
      if (get("furniture-above", x, yy) || wallBusy.has(yy * W + x)) return false;
      if (c < 0 || c === gids[r].length) continue;
      if (!get("walls", x, yy) || [G.vwall, G.vwallCap].includes(get("walls", x, yy))) return false;
    }
    gids.forEach((row, r) => row.forEach((g, c) => set("furniture-above", x0 + c, y0 + r, g)));
    return true;
  };

  const deskTop = (rm: Room) => rm.y + Math.max(0, rm.h - DESK_ROWS * DESK_BLOCK.h);
  const matAt = ([l, m, r]: number[], x0: number, y0: number, w: number) => {
    for (let k = 0; k < w; k++) { set("floor", x0 + k, y0, k === 0 ? l : k === w - 1 ? r : m); reserved.add(y0 * W + x0 + k); }
  };

  let boards: Tile | null = null;
  const doorways: Tile[] = [];
  for (const room of rooms) {
    const { x, y: top, w, h } = room;
    let doorX = x + 1;
    if (room.kind === "dept") {
      const d = room.dept!;
      const y0 = deskTop(room);
      const blocks: Tile[] = [{ x, y: y0 }];
      const pods = Math.ceil((departments[d].agentIds.length - 1) / cfg.podSize);
      const pod = cfg.podSize === 2 ? [[0, 0], [0, DESK_BLOCK.h]] : [[0, 0], [3, 0], [0, DESK_BLOCK.h], [3, DESK_BLOCK.h]];
      for (let p = 0; p < pods; p++)
        for (const [dx, dy] of pod) blocks.push({ x: x + LEAD_GAP + p * (podWidth(cfg.podSize) + 1) + dx, y: y0 + dy });
      departments[d].agentIds.forEach((_, i) => {
        const b = blocks[i];
        stampDesk(b.x, b.y);
        const name = `desk-${d}-${i}`;
        spawns.push({ name, x: b.x + DESK_BLOCK.seat.x, y: b.y + DESK_BLOCK.seat.y });
        seatNames.push(name);
      });
      doorX = x + 3;
      zones.push({ name: `dept-${d}`, x, y: top, w, h });
      const board = BOARDS[d % BOARDS.length];
      const wy = top - board.length;
      const bx = w >= 12 ? x + 6 : x;
      // The first wide room hosts upstream's task board (82px, drawn from bx + 15px); keep that run of wall bare for it.
      if (!boards && w >= 8) {
        boards = { x: bx, y: wy + 1 };
        for (let c = -1; c <= 6; c++) for (let r = 0; r < board.length; r++) wallBusy.add((wy + r) * W + bx + c);
      } else wallDecor(board, bx, wy);
      const todo = palette.todoBoard;
      if (todo && w >= 16) wallDecor(todo, x + w - todo[0].length - 2, top - todo.length);
    } else if (room.kind === "break") {
      const t = TEMPLATE_ROOMS.cafe;
      offsets.cafe = { x: x - t.interior.x, y: top - t.interior.y };
      stampRoom(palette.rooms.cafe, x, top);
      if (palette.cafeStands) doorX = x + palette.cafeStands.doorOffset;
      if (cfg.lounge) {
        const lx = x + t.interior.w;
        stamp(DECOR.bookshelf, lx + 1, top);
        stamp(DECOR.plant, lx + 5, top);
        stamp(DECOR.sofa, lx + 1, top + 3);
        for (let i = 0; i < 3; i++) {
          const name = `lounge-seat-${i + 1}`;
          spawns.push({ name, x: lx + 1 + i, y: top + 4 });
          cafeSeatNames.push(name);
        }
        zones.push({ name: "lounge", x: lx, y: top, w: x + w - lx, h });
      }
    } else if (room.kind === "ceo" || room.kind === "boardroom") {
      const t = TEMPLATE_ROOMS[room.kind];
      offsets[room.kind] = { x: x - t.interior.x, y: top - t.interior.y };
      stampRoom(palette.rooms[room.kind], x, top);
      if (room.kind === "boardroom") doorX = x + 4;
    }
    const dy = room.doorTop ? top - WALL_ROWS : top + h;
    for (let k = 0; k < DOOR_WIDTH; k++)
      for (let r = 0; r < WALL_ROWS; r++) {
        set("walls", doorX + k, dy + r, 0);
        set("collision", doorX + k, dy + r, 0);
        // A doorway in the corridor's upper wall continues the room's floor, not the corridor's.
        if (!room.doorTop) set("floor", doorX + k, dy + r, get("floor", doorX + k, top + h - 1));
      }
    // Keep a clear landing on both sides of every door: three rows in, two out, one tile wider each side.
    const inward = room.doorTop ? 1 : -1;
    const inner = room.doorTop ? top : top + h - 1;
    const outer = room.doorTop ? dy - 1 : dy + WALL_ROWS;
    for (let k = -1; k <= DOOR_WIDTH; k++) {
      for (let r = 0; r < 3; r++) reserved.add((inner + r * inward) * W + doorX + k);
      for (let r = 0; r < 2; r++) reserved.add((outer - r * inward) * W + doorX + k);
    }
    if (palette.doorMat) palette.doorMat.forEach((g, k) => set("floor", doorX + k, inner, g));
    doorways.push({ x: doorX, y: outer });
    const mats = palette.mats;
    if (mats) {
      const mat = mats[room.kind === "dept" ? room.dept! % (mats.length - 1) : mats.length - 1];
      matAt(mat, doorX, room.doorTop ? top : top + h - 1, DOOR_WIDTH);
      if (room.kind === "dept") matAt(mat, x, deskTop(room) + DESK_BLOCK.seat.y, DESK_BLOCK.w);
    }
  }

  // Entrance and reception at the foot of the spine.
  const entrance = { x: sx + Math.floor(sw / 2) - 1, y: H - 2 };
  for (let k = 0; k < DOOR_WIDTH; k++) { set("floor", entrance.x + k, H - 1, palette.floorTile(FLOOR.hall, entrance.x + k, H - 1)); set("walls", entrance.x + k, H - 1, 0); set("collision", entrance.x + k, H - 1, 0); reserved.add((H - 2) * W + entrance.x + k); }
  spawns.push({ name: "entrance", ...entrance });

  const ceo = offsets.ceo;
  spawns.push({ name: "desk-ceo", x: 3 + ceo.x, y: 4 + ceo.y });
  const seats = palette.cafeSeats ?? [[27, 14], [27, 16], [28, 14], [28, 16]];
  const stands = palette.cafeStands ?? { coffee: [26, 20], vending: [29, 13] };
  const cafeSrc = [...seats.map(([sx, sy], i) => [`cafe-seat-${i + 1}`, sx, sy] as const), ["cafe-stand-coffee", ...stands.coffee], ["cafe-stand-vending", ...stands.vending]] as const;
  for (const [name, cx, cy] of cafeSrc) spawns.push({ name, x: cx + offsets.cafe.x, y: cy + offsets.cafe.y });
  cafeSeatNames.unshift("cafe-seat-1", "cafe-seat-2", "cafe-seat-3", "cafe-seat-4");
  const b = TEMPLATE_ROOMS.boardroom.interior, c = TEMPLATE_ROOMS.cafe.interior;
  if (offsets.boardroom) zones.push({ name: "boardroom", x: b.x + offsets.boardroom.x, y: b.y + offsets.boardroom.y, w: b.w, h: b.h });
  zones.push({ name: "cafeteria", x: c.x + offsets.cafe.x, y: c.y + offsets.cafe.y, w: c.w, h: c.h });

  // Decor: placed only where it leaves every spawn reachable from the entrance.
  const spawnAt = new Set(spawns.map((s) => s.y * W + s.x));
  const walkable = (i: number) => L.collision[i] === 0 || spawnAt.has(i);
  const allReachable = () => {
    const seen = new Uint8Array(W * H);
    const q = [entrance.y * W + entrance.x];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop()!;
      const x = i % W;
      for (const n of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1])
        if (n >= 0 && n < W * H && !seen[n] && walkable(n)) { seen[n] = 1; q.push(n); }
    }
    return spawns.every((s) => seen[s.y * W + s.x]);
  };
  const tryDecor = (s: Stamp, x0: number, y0: number, area: Rect) => {
    const cells: number[] = [];
    for (let r = 0; r < s.solid.length; r++) for (let cc = 0; cc < s.solid[r].length; cc++) {
      const x = x0 + cc, yy = y0 + r, i = yy * W + x;
      if (x < area.x || yy < area.y || x >= area.x + area.w || yy >= area.y + area.h) return false;
      if (L.collision[i] || L["furniture-below"][i] || L["furniture-above"][i] || spawnAt.has(i) || reserved.has(i)) return false;
      cells.push(i);
    }
    const saved = TILE_LAYERS.map((l) => cells.map((i) => L[l][i]));
    stamp(s, x0, y0);
    if (allReachable()) return true;
    TILE_LAYERS.forEach((l, li) => cells.forEach((i, k) => { L[l][i] = saved[li][k]; }));
    return false;
  };
  const edgeFill = (area: Rect, kit: Stamp[], limit: number) => {
    let n = 0;
    const spots: Tile[] = [];
    for (let x = area.x; x < area.x + area.w; x++) spots.push({ x, y: area.y });
    for (let yy = area.y + 1; yy < area.y + area.h - 1; yy++) spots.push({ x: area.x, y: yy }, { x: area.x + area.w - 1, y: yy });
    for (const p of spots) {
      if (n >= limit) break;
      if (tryDecor(kit[n % kit.length], p.x, p.y, area)) n++;
    }
  };

  // Plants stand in the four corners of a room, tall ones at the back, so a room reads as furnished, not strewn.
  const cornerPlants = (area: Rect) => {
    const back = [DECOR.plant, DECOR.plant2], front = [DECOR.plant2, DECOR.plant];
    tryDecor(back[0], area.x, area.y, area);
    tryDecor(back[1], area.x + area.w - 1, area.y, area);
    tryDecor(front[0], area.x, area.y + area.h - 2, area);
    tryDecor(front[1], area.x + area.w - 1, area.y + area.h - 2, area);
  };

  for (const room of rooms) {
    const area = { x: room.x, y: room.y, w: room.w, h: room.h };
    if (room.kind === "dept") {
      const y0 = deskTop(room);
      tryDecor(DECOR.bookshelf, room.x, y0 + DESK_BLOCK.h, area);
      const nx = room.x + deptRoomWidth(departments[room.dept!].agentIds.length, cfg.podSize) + 1;
      if (room.x + room.w - nx >= 4) {
        tryDecor(DECOR.bookshelf, nx, y0, area);
        tryDecor(DECOR.sofa, nx, y0 + DESK_BLOCK.h + 1, area);
      }
      // A one-row team in a tall room gets a sofa in the empty half, so the room reads as used.
      const oneRow = departments[room.dept!].agentIds.length - 1 <= cfg.podSize / 2;
      if (oneRow && room.h - (y0 - room.y) - DESK_BLOCK.h >= 3 && room.w >= 8)
        tryDecor(DECOR.sofa, room.x + Math.floor(room.w / 2), room.y + room.h - 3, area);
      cornerPlants(area);
    } else if (room.kind === "ceo") {
      tryDecor(DECOR.sofa, room.x + 3, room.y + room.h - 3, area);
      tryDecor(DECOR.plant2, room.x, room.y + room.h - 2, area);
    } else if (room.kind === "boardroom") {
    } else if (room.kind === "filler") {
      cornerPlants(area);
      tryDecor(DECOR.sofa, room.x + Math.floor(room.w / 2) - 1, room.y + 1, area);
    } else if (room.kind === "break") {
      const lx = room.x + TEMPLATE_ROOMS.cafe.interior.w;
      const kit = palette.loungeKit ?? [DECOR.plant2, DECOR.cooler, DECOR.plant];
      edgeFill({ x: lx, y: room.y, w: room.x + room.w - lx, h: room.h }, kit, palette.loungeKit ? kit.length : 3 * geo.decor);
    }
  }
  const lobby = { x: sx, y: rowTop[K - 1], w: sw, h: H - 1 - rowTop[K - 1] };
  if (cfg.reception) tryDecor(DECOR.reception, sx, H - 6, lobby);

  // Corridor life: a runner down the middle and props standing against the upper wall, never blocking a route.
  const hallKit = palette.hallDecor ?? [];
  const whole = { x: 1, y: OUTER, w: W - 2, h: H - 1 - OUTER };
  // Only the base row sits on the corridor floor; a tall prop's upper rows are drawn over the wall behind it.
  const againstWall = (s: Stamp, x0: number, cy: number) => {
    const last = s.solid.length - 1;
    const base: Stamp = { below: [s.below?.[last] ?? []], above: [s.above?.[last] ?? []], solid: [s.solid[last]] };
    if (!tryDecor(base, x0, cy, whole)) return false;
    for (let r = 0; r < last; r++) s.solid[r].forEach((_, c) => {
      const g = s.above?.[r]?.[c] || s.below?.[r]?.[c];
      if (g) set("furniture-above", x0 + c, cy - last + r, g);
    });
    return true;
  };
  for (const cy of corridors) {
    if (palette.runner && cor >= 2) {
      const [l, m, r] = palette.runner;
      for (let x = 2; x < W - 2; x++) set("floor", x, cy + cor - 1, x === 2 ? l : x === W - 3 ? r : m);
    }
    if (hallKit.length) for (let x = 3, n = 0; x < W - 3; x += 7) if (!inSpine(x) && againstWall(hallKit[n % hallKit.length], x, cy)) n++;
  }

  // Walkways: a bordered rug down the spine from the first corridor to the entrance, then along every corridor.
  const rug = palette.runnerRug;
  if (rug) {
    const lay = (x0: number, y0: number, w: number, h: number) => {
      for (let yy = y0; yy < y0 + h; yy++) for (let x = x0; x < x0 + w; x++) {
        const r = h === 1 ? 1 : yy === y0 ? 0 : yy === y0 + h - 1 ? 2 : 1;
        const c = w === 1 ? 1 : x === x0 ? 0 : x === x0 + w - 1 ? 2 : 1;
        set("floor", x, yy, rug[r][c]);
      }
    };
    const pw = Math.min(2, sw), px = sx + Math.floor((sw - pw) / 2);
    lay(px, spineTop, pw, H + 1 - spineTop);
    for (const cy of corridors) lay(2, cy, W - 4, cor);
    // Open the corridor rug's border where the spine and each doorway join it.
    const open = (x: number, yy: number) => { if (corridors.some((cy) => yy >= cy && yy < cy + cor)) set("floor", x, yy, rug[1][1]); };
    for (let k = 0; k < pw; k++) open(px + k, spineTop + cor - 1);
    for (const d of doorways) for (let k = 0; k < DOOR_WIDTH; k++) open(d.x + k, d.y);
  }

  // Windows along the outer top wall.
  const wallKit = palette.wallKit;
  if (!wallKit?.length) for (let x = 2; x < W - 3; x += 5) wallDecor(WINDOW, x, 1);
  else for (let x = 3, n = 0; x < W - 3; x += 6, n++) {
    const piece = n % 3 === 0 ? WINDOW : wallKit[Math.floor(n / 3 + n) % wallKit.length];
    wallDecor(piece, x, 1);
  }

  const ts = palette.mapBase.tilewidth;
  let id = 1;
  const map: TiledMapJson = {
    ...palette.mapBase,
    width: W,
    height: H,
    layers: [
      ...TILE_LAYERS.map((name) => ({ name, type: "tilelayer" as const, width: W, height: H, x: 0, y: 0, opacity: 1, visible: name !== "collision", data: L[name] })),
      { name: "spawn-points", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true,
        objects: spawns.map((s) => ({ id: id++, name: s.name, type: "", x: s.x * ts, y: s.y * ts, width: 0, height: 0, point: true })) },
      { name: "zones", type: "objectgroup", x: 0, y: 0, opacity: 1, visible: true,
        objects: zones.map((z) => ({ id: id++, name: z.name, type: "", x: z.x * ts, y: z.y * ts, width: z.w * ts, height: z.h * ts })) },
    ],
  };
  return {
    map,
    seatNames,
    cafeSeatNames,
    offsets,
    boards: boards ?? (offsets.boardroom ? { x: offsets.boardroom.x + b.x + 1, y: 1 } : { x: offsets.ceo!.x + 3, y: 1 }),
    entrance,
  };
}

/** Maps a template tile into the generated map if it lies inside a stamped room (decor rows included). */
export function mapTemplateTile(t: Tile, offsets: Partial<Record<TemplateRoom, Tile>>): Tile | null {
  for (const k of Object.keys(TEMPLATE_ROOMS) as TemplateRoom[]) {
    const r = TEMPLATE_ROOMS[k];
    const o = offsets[k];
    if (!o) continue;
    if (t.x >= r.interior.x && t.x < r.interior.x + r.interior.w && t.y >= r.decorTop && t.y < r.interior.y + r.interior.h)
      return { x: t.x + o.x, y: t.y + o.y };
  }
  return null;
}

const layerData = (m: TiledMapJson, name: string) => m.layers.find((l) => l.name === name)?.data ?? [];

/** Copies `rows` x `w` tiles of office.tmj starting at (x0, y0); the first `wallRows` are wall decor. */
function templateStamp(m: TiledMapJson, x0: number, y0: number, w: number, rows: number, wallRows: number): RoomStamp {
  const grid = (name: string) => Array.from({ length: rows }, (_, r) => Array.from({ length: w }, (_, c) => layerData(m, name)[(y0 + r) * m.width + x0 + c] ?? 0));
  return { wallRows, below: grid("furniture-below"), above: grid("furniture-above"), solid: grid("collision").map((row) => row.map((v) => (v ? 1 : 0))) };
}

export const tall = (top: number, bottom: number): Stamp => ({ above: [[top], [0]], below: [[0], [bottom]], solid: [[0], [1]] });

/** LimeZu Modern Interiors (assets/local): rooms and desks are copied from office.tmj, so their gids are never hard-coded. */
export function limezuPalette(template: TiledMapJson): Palette {
  const room = (k: TemplateRoom) => {
    const t = TEMPLATE_ROOMS[k];
    return templateStamp(template, t.interior.x, t.decorTop, t.interior.w, t.interior.y + t.interior.h - t.decorTop, t.interior.y - t.decorTop);
  };
  return {
    id: "limezu",
    mapBase: { ...template, layers: [] },
    // a5 wall gids, as painted in office.tmj.
    walls: {
      wallTop: 522, wallFace: 554, wallBase: 570,
      cornerTL: 514, cornerTR: 517, sideL: 530, sideR: 533,
      bottom: 579, cornerBL: 578, cornerBR: 581,
      vwallCap: 611, vwall: 643,
    },
    // Top-left gid of a 2x2 a5 floor swatch; office.tmj itself uses 783.
    floors: { hall: 781, ceo: 777, boardroom: 775, break: 801, filler: 833, depts: [807, 809, 811, 805, 803, 815, 813, 779, 783] },
    floorTile: (base, x, y) => base + ((x + 1) % 2) + ((y + 1) % 2) * 16,
    // Office-tileset props picked by eye; the sofa is from interiors.png.
    decor: {
      bookshelf: { below: [[153, 154, 155], [169, 170, 171]], solid: [[1, 1, 1], [1, 1, 1]] },
      sofa: { below: [[2178, 2179, 2180], [2194, 2195, 2196]], solid: [[1, 1, 1], [0, 0, 0]] },
      plant: tall(452, 468),
      plant2: tall(451, 467),
      cooler: { below: [[282], [298]], solid: [[1], [1]] },
      boxes: { below: [[473], [489]], solid: [[1], [1]] },
      reception: { below: [[0, 289, 0], [2, 3, 4], [18, 0, 20]], above: [[0, 0, 0], [431, 432, 349], [0, 19, 0]], solid: [[0, 0, 0], [1, 1, 1], [1, 1, 1]] },
    },
    boards: [[[419, 420], [435, 436]], [[421, 422], [437, 438]], [[417, 418], [433, 434]], [[449, 450], [465, 466]]],
    window: [[327, 328], [343, 344]],
    monitorGid: 365,
    rooms: { ceo: room("ceo"), boardroom: room("boardroom"), cafe: room("cafe") },
    desk: templateStamp(template, DESK_BLOCK.x, DESK_BLOCK.y, DESK_BLOCK.w, DESK_BLOCK.h, 0),
  };
}

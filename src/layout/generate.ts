// Builds a Tiled map from the org chart by stamping furniture blocks copied out of upstream's office.tmj.

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

export const LAYOUT = {
  maxRowWidth: 44,
  maxDeskCols: 4,
  deskPitchX: 4,
  deskPitchY: 5,
  corridor: 2,
  doorWidth: 2,
  wallRows: 3,
  lounge: true,
};
export type LayoutConfig = typeof LAYOUT;

const TILE_LAYERS = ["floor", "walls", "furniture-below", "furniture-above", "collision"] as const;
type LayerName = (typeof TILE_LAYERS)[number];
const COPY_LAYERS: LayerName[] = ["furniture-below", "furniture-above"];

// a5 floor/wall gids, as painted in office.tmj.
const G = {
  floor: [[799, 800], [783, 784]],
  wallTop: 522, wallFace: 554, wallBase: 570,
  cornerTL: 514, cornerTR: 517, sideL: 530, sideR: 533,
  bottom: 579, cornerBL: 578, cornerBR: 581,
  vwallCap: 611, vwall: 643,
};

/** office.tmj regions: `interior` is walkable room space, `decorTop` is the first wall row whose props come along. */
export const TEMPLATE_ROOMS = {
  ceo: { interior: { x: 1, y: 3, w: 6, h: 5 }, decorTop: 1, door: 4 },
  boardroom: { interior: { x: 9, y: 3, w: 9, h: 5 }, decorTop: 1, door: 4 },
  cafe: { interior: { x: 25, y: 12, w: 8, h: 9 }, decorTop: 10, door: 0 },
} as const;
export type TemplateRoom = keyof typeof TEMPLATE_ROOMS;
/** The pc-1 desk block: monitor two rows up, chair row, chair foot row. */
const DESK_BLOCK = { x: 1, y: 11, w: 3, h: 4, seat: { x: 1, y: 2 } };

// Lounge props: bookshelf pair and grey sofa identified by eye in the tilesets (unused by office.tmj); plant 468 is office.tmj's.
export const LOUNGE_GIDS = {
  bookshelf: [[153, 154, 155], [169, 170, 171]],
  sofa: [[2178, 2179, 2180], [2194, 2195, 2196]],
  plant: [[468]],
};
const LOUNGE_SIZE = { w: 8, h: 5 };

export interface GeneratedOffice {
  map: TiledMapJson;
  seatNames: string[];
  cafeSeatNames: string[];
  /** Offset to add to a template tile inside each stamped room. */
  offsets: Record<TemplateRoom, Tile>;
  boards: Tile;
  entrance: Tile;
}

interface Room { kind: TemplateRoom | "lounge" | "dept"; w: number; h: number; dept?: number; cols?: number; x?: number; y?: number }

export function deptRoomSize(headcount: number, cfg: LayoutConfig = LAYOUT): { cols: number; rows: number; w: number; h: number } {
  const n = Math.max(1, headcount);
  const cols = Math.min(cfg.maxDeskCols, n);
  const rows = Math.ceil(n / cols);
  return { cols, rows, w: 1 + cfg.deskPitchX * cols, h: 1 + cfg.deskPitchY * rows };
}

function packBands(rooms: Room[], maxWidth: number): Room[][] {
  const bands: Room[][] = [];
  let band: Room[] = [];
  let width = 0;
  for (const r of rooms) {
    const add = band.length ? r.w + 1 : r.w;
    if (band.length && width + add > maxWidth) { bands.push(band); band = []; width = 0; }
    width += band.length ? r.w + 1 : r.w;
    band.push(r);
  }
  if (band.length) bands.push(band);
  return bands;
}

const bandWidth = (b: Room[]) => b.reduce((s, r) => s + r.w, 0) + b.length - 1;

export function generateOfficeMap(
  departments: DepartmentInput[],
  template: TiledMapJson,
  cfg: LayoutConfig = LAYOUT,
): GeneratedOffice {
  const special: Room[] = (["ceo", "boardroom", "cafe"] as const).map((k) => ({
    kind: k, w: TEMPLATE_ROOMS[k].interior.w, h: TEMPLATE_ROOMS[k].interior.h,
  }));
  if (cfg.lounge) special.push({ kind: "lounge", ...LOUNGE_SIZE });
  const deptRooms: Room[] = departments.map((d, i) => {
    const s = deptRoomSize(d.agentIds.length, cfg);
    return { kind: "dept", w: s.w, h: s.h, dept: i, cols: s.cols };
  });
  const bands = [special, ...packBands(deptRooms, cfg.maxRowWidth)];
  const innerW = Math.max(...bands.map(bandWidth));
  const W = innerW + 2;
  const between = cfg.wallRows + cfg.corridor;

  // Vertical layout: outer top wall, then each band followed by a doored wall and a corridor, then the bottom wall.
  const bandY: number[] = [];
  let y = cfg.wallRows;
  bands.forEach((b, i) => {
    if (i > 0) y += between;
    bandY.push(y);
    y += Math.max(...b.map((r) => r.h));
  });
  const lastWallY = y;
  const H = lastWallY + cfg.wallRows + cfg.corridor + 1;

  const L = Object.fromEntries(TILE_LAYERS.map((n) => [n, new Array<number>(W * H).fill(0)])) as Record<LayerName, number[]>;
  const set = (layer: LayerName, x: number, yy: number, g: number) => {
    if (x >= 0 && yy >= 0 && x < W && yy < H) L[layer][yy * W + x] = g;
  };
  const tpl = (layer: LayerName, x: number, yy: number) =>
    (template.layers.find((l) => l.name === layer)?.data ?? [])[yy * template.width + x] ?? 0;

  for (let yy = cfg.wallRows; yy < H - 1; yy++)
    for (let x = 1; x < W - 1; x++) set("floor", x, yy, G.floor[yy % 2][x % 2]);

  // Outer shell.
  for (let x = 0; x < W; x++) {
    set("walls", x, 0, x === 0 ? G.cornerTL : x === W - 1 ? G.cornerTR : G.wallTop);
    for (let r = 1; r < cfg.wallRows; r++) set("walls", x, r, x === 0 ? G.sideL : x === W - 1 ? G.sideR : r === 1 ? G.wallFace : G.wallBase);
    set("walls", x, H - 1, x === 0 ? G.cornerBL : x === W - 1 ? G.cornerBR : G.bottom);
    for (let r = 0; r < cfg.wallRows; r++) set("collision", x, r, 1);
    set("collision", x, H - 1, 1);
  }
  for (let yy = 1; yy < H - 1; yy++) {
    if (yy >= cfg.wallRows) { set("walls", 0, yy, G.sideL); set("walls", W - 1, yy, G.sideR); }
    set("collision", 0, yy, 1);
    set("collision", W - 1, yy, 1);
  }
  const hwall = (y0: number) => {
    for (let x = 1; x < W - 1; x++) {
      [G.wallTop, G.wallFace, G.wallBase].forEach((g, r) => { set("walls", x, y0 + r, g); set("collision", x, y0 + r, 1); });
    }
  };
  const door = (x: number, y0: number) => {
    for (let r = 0; r < cfg.wallRows; r++) { set("walls", x, y0 + r, 0); set("collision", x, y0 + r, 0); }
  };

  const spawns: { name: string; x: number; y: number }[] = [];
  const zones: { name: string; x: number; y: number; w: number; h: number }[] = [];
  const seatNames: string[] = [];
  const cafeSeatNames: string[] = [];
  const offsets = {} as Record<TemplateRoom, Tile>;

  const stampTemplate = (src: Rect, decorTop: number, dx: number, dy: number) => {
    for (let yy = decorTop; yy < src.y + src.h; yy++)
      for (let x = src.x; x < src.x + src.w; x++) {
        for (const l of COPY_LAYERS) { const g = tpl(l, x, yy); if (g) set(l, x + dx, yy + dy, g); }
        if (yy >= src.y) set("collision", x + dx, yy + dy, tpl("collision", x, yy) ? 1 : 0);
      }
  };
  const stampGids = (gids: number[][], x0: number, y0: number, layer: LayerName, solid: boolean) =>
    gids.forEach((row, r) => row.forEach((g, c) => { set(layer, x0 + c, y0 + r, g); if (solid) set("collision", x0 + c, y0 + r, 1); }));

  const doorCols: { band: number; x: number }[] = [];
  bands.forEach((band, bi) => {
    const top = bandY[bi];
    const bandH = Math.max(...band.map((r) => r.h));
    let x = 1;
    band.forEach((room, ri) => {
      const last = ri === band.length - 1;
      const w = last ? W - 1 - x : room.w;
      room.x = x; room.y = top;
      if (!last) {
        for (let r = 0; r < bandH; r++) { set("walls", x + w, top + r, r === 0 ? G.vwallCap : G.vwall); set("collision", x + w, top + r, 1); }
      }
      if (room.kind === "dept") {
        const dept = departments[room.dept!];
        dept.agentIds.forEach((_, i) => {
          const c = i % room.cols!, r = Math.floor(i / room.cols!);
          const bx = x + 1 + c * cfg.deskPitchX, by = top + 1 + r * cfg.deskPitchY;
          stampTemplate({ x: DESK_BLOCK.x, y: DESK_BLOCK.y, w: DESK_BLOCK.w, h: DESK_BLOCK.h }, DESK_BLOCK.y, bx - DESK_BLOCK.x, by - DESK_BLOCK.y);
          const name = `seat-${room.dept}-${i}`;
          spawns.push({ name, x: bx + DESK_BLOCK.seat.x, y: by + DESK_BLOCK.seat.y });
          seatNames.push(name);
        });
        zones.push({ name: `dept-${room.dept}`, x, y: top, w, h: bandH });
        doorCols.push({ band: bi, x: x + 1 + Math.floor((room.cols! * cfg.deskPitchX) / 2) - 1 });
      } else if (room.kind === "lounge") {
        stampGids(LOUNGE_GIDS.bookshelf, x + 1, top, "furniture-below", true);
        stampGids(LOUNGE_GIDS.plant, x + 6, top, "furniture-below", true);
        stampGids(LOUNGE_GIDS.sofa.slice(0, 1), x + 2, top + 2, "furniture-below", true);
        stampGids(LOUNGE_GIDS.sofa.slice(1), x + 2, top + 3, "furniture-below", false);
        for (let i = 0; i < 3; i++) {
          const name = `lounge-seat-${i + 1}`;
          spawns.push({ name, x: x + 2 + i, y: top + 3 });
          cafeSeatNames.push(name);
        }
        zones.push({ name: "lounge", x, y: top, w: LOUNGE_SIZE.w, h: LOUNGE_SIZE.h });
        doorCols.push({ band: bi, x });
      } else {
        const t = TEMPLATE_ROOMS[room.kind];
        const dx = x - t.interior.x, dy = top - t.interior.y;
        offsets[room.kind] = { x: dx, y: dy };
        stampTemplate(t.interior, t.decorTop, dx, dy);
        doorCols.push({ band: bi, x: x + t.door });
      }
      x += w + 1;
    });
  });


  const corridors: number[] = [];
  bands.forEach((_, bi) => {
    const bottomWall = bi + 1 < bands.length ? bandY[bi + 1] - between : lastWallY;
    hwall(bottomWall);
    corridors.push(bottomWall + cfg.wallRows);
  });
  for (const d of doorCols) {
    const bottomWall = d.band + 1 < bands.length ? bandY[d.band + 1] - between : lastWallY;
    for (let k = 0; k < cfg.doorWidth; k++) {
      door(d.x + k, bottomWall);
    }
  }

  const entrance = { x: Math.floor(W / 2), y: H - 2 };
  set("walls", entrance.x, H - 1, 0);
  set("collision", entrance.x, H - 1, 0);
  spawns.push({ name: "entrance", ...entrance });

  const ceo = offsets.ceo;
  spawns.push({ name: "desk-ceo", x: 3 + ceo.x, y: 4 + ceo.y });
  const cafeSrc = [["cafe-seat-1", 27, 14], ["cafe-seat-2", 27, 16], ["cafe-seat-3", 28, 14], ["cafe-seat-4", 28, 16], ["cafe-stand-coffee", 26, 20], ["cafe-stand-vending", 29, 13]] as const;
  for (const [name, sx, sy] of cafeSrc) spawns.push({ name, x: sx + offsets.cafe.x, y: sy + offsets.cafe.y });
  cafeSeatNames.unshift("cafe-seat-1", "cafe-seat-2", "cafe-seat-3", "cafe-seat-4");
  const b = TEMPLATE_ROOMS.boardroom.interior, c = TEMPLATE_ROOMS.cafe.interior;
  zones.push({ name: "boardroom", x: b.x + offsets.boardroom.x, y: b.y + offsets.boardroom.y, w: b.w, h: b.h });
  zones.push({ name: "cafeteria", x: c.x + offsets.cafe.x, y: c.y + offsets.cafe.y, w: c.w, h: c.h });

  const ts = template.tilewidth;
  let id = 1;
  const map: TiledMapJson = {
    ...template,
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
    boards: { x: 1 + TEMPLATE_ROOMS.ceo.interior.w - 1, y: corridors[0] - 1 },
    entrance,
  };
}

/** Maps a template tile into the generated map if it lies inside a stamped room (decor rows included). */
export function mapTemplateTile(t: Tile, offsets: Record<TemplateRoom, Tile>): Tile | null {
  for (const k of Object.keys(TEMPLATE_ROOMS) as TemplateRoom[]) {
    const r = TEMPLATE_ROOMS[k];
    if (t.x >= r.interior.x && t.x < r.interior.x + r.interior.w && t.y >= r.decorTop && t.y < r.interior.y + r.interior.h)
      return { x: t.x + offsets[k].x, y: t.y + offsets[k].y };
  }
  return null;
}

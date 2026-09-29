import { Container, Graphics, Text } from "pixi.js";

export const PLAQUE_OPEN_EVENT = "office:wall-of-fame";
const PLAQUE_TILES = 3;
const WALL_ROWS = [1, 2];
const TEXT_RESOLUTION = 6;

interface TileLayer { name: string; type?: string; data?: number[] }
interface SceneMap { width: number; tilewidth: number; layers: TileLayer[] }

let sceneMap: SceneMap | null = null;
let nameText: Text | null = null;
let currentName = "";

export function setSceneMap(map: unknown): void {
  sceneMap = map as SceneMap;
}

/** Leftmost tile of the widest run of bare top wall (wall tile, nothing hung on it), nearest the middle on ties. */
export function findPlaqueTile(map: SceneMap, width = PLAQUE_TILES): { x: number; y: number } | null {
  const layer = (n: string) => map.layers.find((l) => l.name === n)?.data ?? [];
  const walls = layer("walls");
  const decor = [layer("furniture-below"), layer("furniture-above")];
  const bare = (x: number) =>
    WALL_ROWS.every((y) => {
      const i = y * map.width + x;
      return walls[i] && decor.every((d) => !d[i]);
    });
  let best: { x: number; len: number } | null = null;
  let start = -1;
  for (let x = 0; x <= map.width; x++) {
    if (x < map.width && bare(x)) {
      if (start < 0) start = x;
      continue;
    }
    if (start >= 0) {
      const len = x - start;
      const mid = Math.abs(start + len / 2 - map.width / 2);
      const bestMid = best ? Math.abs(best.x + best.len / 2 - map.width / 2) : Infinity;
      if (len >= width && (!best || len > best.len || (len === best.len && mid < bestMid))) best = { x: start, len };
      start = -1;
    }
  }
  return best ? { x: best.x + Math.floor((best.len - width) / 2), y: WALL_ROWS[0] } : null;
}

function label(text: string, size: number, color: number): Text {
  const t = new Text({ text, style: { fontFamily: "monospace", fontSize: size, fill: color, fontWeight: "bold" } });
  t.resolution = TEXT_RESOLUTION;
  t.anchor.set(0.5, 0);
  return t;
}

/** Hangs a clickable Wall of Fame frame on the office wall; called with the camera's world container. */
export function mountPlaque(world: Container): void {
  const spot = sceneMap && findPlaqueTile(sceneMap);
  if (!sceneMap || !spot) return;
  const ts = sceneMap.tilewidth;
  const w = PLAQUE_TILES * ts;
  const h = WALL_ROWS.length * ts - 4;

  const plaque = new Container();
  plaque.position.set(spot.x * ts, spot.y * ts + 1);
  plaque.eventMode = "static";
  plaque.cursor = "pointer";
  plaque.on("pointertap", () => window.dispatchEvent(new Event(PLAQUE_OPEN_EVENT)));

  const frame = new Graphics()
    .rect(0, 0, w, h).fill(0x8a5a1c)
    .rect(1, 1, w - 2, h - 2).fill(0xd8a441)
    .rect(3, 3, w - 6, h - 6).fill(0x3b2412);
  const star = new Graphics().star(w / 2, 8, 5, 3.2, 1.4).fill(0xffd34d);
  const title = label("EMPLOYEE OF THE WEEK", 2.6, 0xf4e6c8);
  title.position.set(w / 2, 12.5);
  nameText = label(currentName, 3, 0xffd34d);
  nameText.position.set(w / 2, 16.5);

  plaque.addChild(frame, star, title, nameText);
  world.addChild(plaque);
}

export function setPlaqueName(name: string): void {
  currentName = name.length > 18 ? name.slice(0, 17) + "…" : name;
  if (nameText && !nameText.destroyed) nameText.text = currentName;
}

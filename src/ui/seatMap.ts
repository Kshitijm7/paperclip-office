import { assignSeats, resolveSeatTiles, type Tile, type ZoneRect } from "../layout/seatAssignment.js";
import { findPath } from "../../vendor/munder-difflin/src/renderer/src/scene/office/pathfinding.js";

const TILE_ID_MASK = 0x1fffffff;
const BOARDROOM_ZONE = "boardroom";

interface MapObject {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}
interface MapLayer {
  name: string;
  type?: string;
  data?: number[];
  objects?: MapObject[];
}
interface SceneMap {
  width: number;
  height: number;
  tilewidth: number;
  layers: MapLayer[];
}

let sceneMap: SceneMap | null = null;
let seatNames: string[] = [];

/** Records the map + theme seat order the floor is about to render, so the heatmap can find the
 *  same desk tiles upstream's OfficeFloor claims. Called alongside wallPlaque's setSceneMap. */
export function setSeatSceneMap(map: unknown, primarySeatNames: string[]): void {
  sceneMap = map as SceneMap;
  seatNames = primarySeatNames;
}

function findLayer(map: SceneMap, name: string): MapLayer | undefined {
  return map.layers.find((l) => l.name === name);
}

function spawnPoints(map: SceneMap): Map<string, Tile> {
  const out = new Map<string, Tile>();
  for (const obj of findLayer(map, "spawn-points")?.objects ?? []) {
    out.set(obj.name, { x: Math.floor(obj.x / map.tilewidth), y: Math.floor(obj.y / map.tilewidth) });
  }
  return out;
}

function boardroomZone(map: SceneMap): ZoneRect | undefined {
  const obj = findLayer(map, "zones")?.objects?.find((o) => o.name === BOARDROOM_ZONE);
  if (!obj) return undefined;
  return {
    x: Math.floor(obj.x / map.tilewidth),
    y: Math.floor(obj.y / map.tilewidth),
    width: Math.floor((obj.width ?? 0) / map.tilewidth),
    height: Math.floor((obj.height ?? 0) / map.tilewidth),
  };
}

function isWalkable(map: SceneMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const collision = findLayer(map, "collision")?.data;
  if (!collision) return true;
  return ((collision[y * map.width + x] ?? 0) & TILE_ID_MASK) === 0;
}

/** Desk tile per agent id, for the currently loaded map + seat order. */
export function getSeatAssignments(agents: { id: string; isChief: boolean }[]): Map<string, Tile> {
  if (!sceneMap) return new Map();
  const seatTiles = resolveSeatTiles(seatNames, spawnPoints(sceneMap), boardroomZone(sceneMap), (x, y) =>
    isWalkable(sceneMap!, x, y),
  );
  return assignSeats(seatTiles, agents);
}

export function getSceneTileSize(): number {
  return sceneMap?.tilewidth ?? 16;
}

/** The office door, for anything that should walk in the way agents do. */
export function getSpawnTile(name: string): Tile | null {
  if (!sceneMap) return null;
  return spawnPoints(sceneMap).get(name) ?? null;
}

export function getEntranceTile(): Tile | null {
  if (!sceneMap) return null;
  return spawnPoints(sceneMap).get("entrance") ?? null;
}

/** BFS path between two tiles on the currently loaded map (vendor's own pathfinder, no map instance needed). */
export function findWalkPath(from: Tile, to: Tile): Tile[] | null {
  if (!sceneMap) return null;
  const map = sceneMap;
  const walk = (x: number, y: number) => isWalkable(map, x, y);
  const start = nearestWalkable(from, walk);
  const end = nearestWalkable(to, walk);
  if (!start || !end) return null;
  return findPath({ width: map.width, height: map.height, isWalkable: walk }, start, end);
}

function nearestWalkable(t: Tile, walk: (x: number, y: number) => boolean, maxR = 4): Tile | null {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walk(t.x + dx, t.y + dy)) return { x: t.x + dx, y: t.y + dy };
      }
    }
  }
  return null;
}

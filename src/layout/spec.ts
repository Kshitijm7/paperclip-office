// Every tunable of the generated floor, serializable so a preset, a saved choice or an agent can supply it.

export const TOP_BAND_ITEMS = ["ceo", "boardroom", "departments", "break"] as const;
export type TopBandItem = (typeof TOP_BAND_ITEMS)[number];
export const DEPT_ORDERS = ["org", "size", "name"] as const;
export type DeptOrder = (typeof DEPT_ORDERS)[number];
export const POD_SIZES = [2, 4] as const;
export type PodSize = (typeof POD_SIZES)[number];

export interface LayoutSpec {
  /** Room order in rows: org-chart order, biggest first, or alphabetical. */
  deptOrder: DeptOrder;
  /** Desks per pod: 2 (one column) or 4 (two facing pairs). */
  podSize: PodSize;
  /** Most department rooms side by side in one band segment. */
  maxColumns: number;
  /** Most bands of rooms, top band included. */
  maxRows: number;
  /** Target width / height of the whole floor. */
  aspect: number;
  /** Corridor height in tiles between facing rows. */
  corridor: number;
  /** Width in tiles of the central walkway. */
  spineWidth: number;
  /** Walls between neighbouring department rooms; false opens them into one floor. */
  roomWalls: boolean;
  /** Each department gets its own floor colour. */
  floorPerDepartment: boolean;
  lounge: boolean;
  boardroom: boolean;
  reception: boolean;
  /** Left-to-right order of the top band. */
  topBand: TopBandItem[];
}

export const SPEC_LIMITS = {
  maxColumns: { min: 1, max: 12 },
  maxRows: { min: 2, max: 9 },
  aspect: { min: 0.8, max: 3 },
  corridor: { min: 1, max: 4 },
  spineWidth: { min: 4, max: 10 },
} as const;

export const DEFAULT_SPEC: LayoutSpec = {
  deptOrder: "org",
  podSize: 4,
  maxColumns: 12,
  maxRows: 7,
  aspect: 1.6,
  corridor: 2,
  spineWidth: 6,
  roomWalls: true,
  floorPerDepartment: true,
  lounge: true,
  boardroom: true,
  reception: true,
  topBand: ["ceo", "boardroom", "departments", "break"],
};

function num(v: unknown, lim: { min: number; max: number }, fallback: number, integer = true): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const c = Math.min(lim.max, Math.max(lim.min, n));
  return integer ? Math.round(c) : Math.round(c * 100) / 100;
}

function oneOf<T>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Known items in the given order, duplicates dropped, missing ones appended in default order. */
function topBand(v: unknown): TopBandItem[] {
  const given = Array.isArray(v) ? v.filter((x): x is TopBandItem => TOP_BAND_ITEMS.includes(x)) : [];
  return [...new Set([...given, ...DEFAULT_SPEC.topBand])];
}

/** Clamps and defaults any input into a valid spec; never throws. */
export function normalizeLayoutSpec(raw: unknown, base: LayoutSpec = DEFAULT_SPEC): LayoutSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const L = SPEC_LIMITS;
  return {
    deptOrder: oneOf(r.deptOrder, DEPT_ORDERS, base.deptOrder),
    podSize: oneOf(typeof r.podSize === "string" ? Number(r.podSize) : r.podSize, POD_SIZES, base.podSize),
    maxColumns: num(r.maxColumns, L.maxColumns, base.maxColumns),
    maxRows: num(r.maxRows, L.maxRows, base.maxRows),
    aspect: num(r.aspect, L.aspect, base.aspect, false),
    corridor: num(r.corridor, L.corridor, base.corridor),
    spineWidth: num(r.spineWidth, L.spineWidth, base.spineWidth),
    roomWalls: bool(r.roomWalls, base.roomWalls),
    floorPerDepartment: bool(r.floorPerDepartment, base.floorPerDepartment),
    lounge: bool(r.lounge, base.lounge),
    boardroom: bool(r.boardroom, base.boardroom),
    reception: bool(r.reception, base.reception),
    topBand: r.topBand === undefined ? [...base.topBand] : topBand(r.topBand),
  };
}

/** JSON schema of LayoutSpec, handed to agents in the design brief and used as the tool's parameter schema. */
export const LAYOUT_SPEC_SCHEMA = {
  type: "object",
  properties: {
    deptOrder: { type: "string", enum: [...DEPT_ORDERS], description: "Room order: org chart order, biggest department first, or by name." },
    podSize: { type: "number", enum: [...POD_SIZES], description: "Desks per pod: 2 (single column) or 4 (two facing pairs)." },
    maxColumns: { type: "integer", minimum: SPEC_LIMITS.maxColumns.min, maximum: SPEC_LIMITS.maxColumns.max, description: "Most department rooms side by side on one side of the walkway." },
    maxRows: { type: "integer", minimum: SPEC_LIMITS.maxRows.min, maximum: SPEC_LIMITS.maxRows.max, description: "Most bands of rooms, top band included." },
    aspect: { type: "number", minimum: SPEC_LIMITS.aspect.min, maximum: SPEC_LIMITS.aspect.max, description: "Target floor width divided by height." },
    corridor: { type: "integer", minimum: SPEC_LIMITS.corridor.min, maximum: SPEC_LIMITS.corridor.max, description: "Corridor height in tiles." },
    spineWidth: { type: "integer", minimum: SPEC_LIMITS.spineWidth.min, maximum: SPEC_LIMITS.spineWidth.max, description: "Central walkway width in tiles." },
    roomWalls: { type: "boolean", description: "Walls between neighbouring department rooms (false = open plan)." },
    floorPerDepartment: { type: "boolean", description: "Give each department its own floor colour." },
    lounge: { type: "boolean", description: "Add a lounge beside the cafe." },
    boardroom: { type: "boolean", description: "Include the boardroom." },
    reception: { type: "boolean", description: "Put a reception desk at the entrance." },
    topBand: { type: "array", items: { type: "string", enum: [...TOP_BAND_ITEMS] }, description: "Left-to-right order of the top band of rooms." },
  },
} as const;

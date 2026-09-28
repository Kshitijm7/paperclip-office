import { DEFAULT_SPEC, normalizeLayoutSpec, type LayoutSpec } from "./spec.js";

export interface LayoutPreset { id: string; label: string; spec: LayoutSpec }

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: "departments", label: "Departments", spec: DEFAULT_SPEC },
  {
    id: "open-plan",
    label: "Open plan",
    spec: normalizeLayoutSpec({ roomWalls: false, floorPerDepartment: false, spineWidth: 8, corridor: 3, aspect: 2, maxRows: 3, deptOrder: "size" }),
  },
  {
    id: "compact",
    label: "Compact",
    spec: normalizeLayoutSpec({ corridor: 1, spineWidth: 4, lounge: false, boardroom: false, reception: false, aspect: 1.3, topBand: ["ceo", "departments", "break"] }),
  },
  {
    id: "campus",
    label: "Campus",
    spec: normalizeLayoutSpec({ podSize: 2, maxColumns: 2, corridor: 3, spineWidth: 8, aspect: 1.8, maxRows: 9, deptOrder: "size", topBand: ["break", "ceo", "departments", "boardroom"] }),
  },
];

export const PRESET_IDS = LAYOUT_PRESETS.map((p) => p.id);
export const DEFAULT_PRESET_ID = LAYOUT_PRESETS[0].id;

export function presetSpec(id: string): LayoutSpec {
  return (LAYOUT_PRESETS.find((p) => p.id === id) ?? LAYOUT_PRESETS[0]).spec;
}

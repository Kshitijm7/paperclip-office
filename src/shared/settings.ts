import type { CostMetric } from "./cost.js";
import { DEFAULT_PRESET_ID, PRESET_IDS } from "../layout/presets.js";

const COST_METRICS: CostMetric[] = ["auto", "dollars", "tokens"];
export type OfficeTheme = "office" | "brooklyn99" | "generated" | "free";
export type IdleRoaming = "off" | "calm" | "lively";
export type BubbleContent = "activity" | "issue" | "output" | "none";
export type CastStyle = "office" | "neutral";
export type OfficeLanguage = "en" | "ar" | "zh-CN";
export type FameRanking = "productivity" | "efficiency" | "current";

export interface OfficeSettings {
  viewOnly: boolean;
  theme: OfficeTheme;
  stuckMinutes: number;
  pollSeconds: number;
  idleRoaming: IdleRoaming;
  chatter: boolean;
  bubbles: BubbleContent;
  castStyle: CastStyle;
  language: OfficeLanguage;
  showOrgPanel: boolean;
  showStateBoard: boolean;
  activityFeed: boolean;
  activityWindowHours: number;
  activityLimit: number;
  officeStatusTool: boolean;
  overloadThreshold: number;
  heatmap: boolean;
  heatLow: number;
  heatHigh: number;
  search: boolean;
  bottleneckCount: number;
  showCost: boolean;
  costWindowDays: number;
  costMetric: CostMetric;
  budgetAlerts: boolean;
  askBoard: boolean;
  layoutPreset: string;
  layoutPicker: boolean;
  agentLayouts: boolean;
  layoutDesignerAgentId: string;
  decisionBox: boolean;
  decisionIssueScan: number;
  scoring: boolean;
  scoreWindowDays: number;
  efficiencyStuckPenalty: number;
  scoreboard: boolean;
  fameRanking: FameRanking;
  paEnabled: boolean;
  paReports: boolean;
  paIntervalMinutes: number;
  roleAttire: boolean;
  nameplates: boolean;
  issueTags: boolean;
  stateRings: boolean;
  rosterSidebar: boolean;
}

export const DEFAULTS: OfficeSettings = {
  viewOnly: false,
  theme: "free",
  stuckMinutes: 10,
  pollSeconds: 4,
  idleRoaming: "lively",
  chatter: true,
  bubbles: "activity",
  castStyle: "office",
  language: "en",
  showOrgPanel: true,
  showStateBoard: true,
  activityFeed: true,
  activityWindowHours: 24,
  activityLimit: 100,
  officeStatusTool: true,
  overloadThreshold: 5,
  heatmap: true,
  heatLow: 2,
  heatHigh: 5,
  search: true,
  bottleneckCount: 5,
  showCost: true,
  costWindowDays: 7,
  costMetric: "auto",
  budgetAlerts: true,
  askBoard: true,
  layoutPreset: DEFAULT_PRESET_ID,
  layoutPicker: true,
  agentLayouts: true,
  layoutDesignerAgentId: "",
  decisionBox: true,
  decisionIssueScan: 40,
  scoring: true,
  scoreWindowDays: 7,
  efficiencyStuckPenalty: 0.02,
  scoreboard: true,
  fameRanking: "productivity",
  paEnabled: true,
  paReports: true,
  paIntervalMinutes: 30,
  roleAttire: true,
  nameplates: true,
  issueTags: true,
  stateRings: true,
  rosterSidebar: true,
};

const THEMES: OfficeTheme[] = ["office", "brooklyn99", "generated", "free"];
const ROAMING: IdleRoaming[] = ["off", "calm", "lively"];
const BUBBLES: BubbleContent[] = ["activity", "issue", "output", "none"];
const CAST_STYLES: CastStyle[] = ["office", "neutral"];
const LANGUAGES: OfficeLanguage[] = ["en", "ar", "zh-CN"];
const FAME_RANKINGS: FameRanking[] = ["productivity", "efficiency", "current"];

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function clampFloat(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function normalize(raw: unknown): OfficeSettings {
  const r = (raw ?? {}) as Partial<Record<keyof OfficeSettings, unknown>>;
  return {
    viewOnly: bool(r.viewOnly, DEFAULTS.viewOnly),
    theme: pick(r.theme, THEMES, DEFAULTS.theme),
    stuckMinutes: clamp(r.stuckMinutes, 1, 240, DEFAULTS.stuckMinutes),
    pollSeconds: clamp(r.pollSeconds, 2, 60, DEFAULTS.pollSeconds),
    idleRoaming: pick(r.idleRoaming, ROAMING, DEFAULTS.idleRoaming),
    chatter: bool(r.chatter, DEFAULTS.chatter),
    bubbles: pick(r.bubbles, BUBBLES, DEFAULTS.bubbles),
    castStyle: pick(r.castStyle, CAST_STYLES, DEFAULTS.castStyle),
    language: pick(r.language, LANGUAGES, DEFAULTS.language),
    showOrgPanel: bool(r.showOrgPanel, DEFAULTS.showOrgPanel),
    showStateBoard: bool(r.showStateBoard, DEFAULTS.showStateBoard),
    activityFeed: bool(r.activityFeed, DEFAULTS.activityFeed),
    activityWindowHours: clamp(r.activityWindowHours, 1, 168, DEFAULTS.activityWindowHours),
    activityLimit: clamp(r.activityLimit, 10, 500, DEFAULTS.activityLimit),
    officeStatusTool: bool(r.officeStatusTool, DEFAULTS.officeStatusTool),
    overloadThreshold: clamp(r.overloadThreshold, 1, 50, DEFAULTS.overloadThreshold),
    heatmap: bool(r.heatmap, DEFAULTS.heatmap),
    heatLow: clamp(r.heatLow, 1, 999, DEFAULTS.heatLow),
    heatHigh: clamp(r.heatHigh, 1, 999, DEFAULTS.heatHigh),
    search: bool(r.search, DEFAULTS.search),
    bottleneckCount: clamp(r.bottleneckCount, 1, 20, DEFAULTS.bottleneckCount),
    showCost: bool(r.showCost, DEFAULTS.showCost),
    costWindowDays: clamp(r.costWindowDays, 1, 90, DEFAULTS.costWindowDays),
    costMetric: pick(r.costMetric, COST_METRICS, DEFAULTS.costMetric),
    budgetAlerts: bool(r.budgetAlerts, DEFAULTS.budgetAlerts),
    askBoard: bool(r.askBoard, DEFAULTS.askBoard),
    layoutPreset: pick(r.layoutPreset, PRESET_IDS, DEFAULTS.layoutPreset),
    layoutPicker: bool(r.layoutPicker, DEFAULTS.layoutPicker),
    agentLayouts: bool(r.agentLayouts, DEFAULTS.agentLayouts),
    layoutDesignerAgentId: typeof r.layoutDesignerAgentId === "string" ? r.layoutDesignerAgentId.trim() : DEFAULTS.layoutDesignerAgentId,
    decisionBox: bool(r.decisionBox, DEFAULTS.decisionBox),
    decisionIssueScan: clamp(r.decisionIssueScan, 1, 500, DEFAULTS.decisionIssueScan),
    scoring: bool(r.scoring, DEFAULTS.scoring),
    scoreWindowDays: clamp(r.scoreWindowDays, 1, 90, DEFAULTS.scoreWindowDays),
    efficiencyStuckPenalty: clampFloat(r.efficiencyStuckPenalty, 0, 1, DEFAULTS.efficiencyStuckPenalty),
    scoreboard: bool(r.scoreboard, DEFAULTS.scoreboard),
    fameRanking: pick(r.fameRanking, FAME_RANKINGS, DEFAULTS.fameRanking),
    paEnabled: bool(r.paEnabled, DEFAULTS.paEnabled),
    paReports: bool(r.paReports, DEFAULTS.paReports),
    paIntervalMinutes: clamp(r.paIntervalMinutes, 5, 1440, DEFAULTS.paIntervalMinutes),
    roleAttire: bool(r.roleAttire, DEFAULTS.roleAttire),
    nameplates: bool(r.nameplates, DEFAULTS.nameplates),
    issueTags: bool(r.issueTags, DEFAULTS.issueTags),
    stateRings: bool(r.stateRings, DEFAULTS.stateRings),
    rosterSidebar: bool(r.rosterSidebar, DEFAULTS.rosterSidebar),
  };
}

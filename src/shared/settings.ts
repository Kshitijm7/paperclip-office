import type { CostMetric } from "./cost.js";

const COST_METRICS: CostMetric[] = ["auto", "dollars", "tokens"];
export type OfficeTheme = "office" | "brooklyn99" | "generated";
export type IdleRoaming = "off" | "calm" | "lively";
export type BubbleContent = "activity" | "issue" | "output" | "none";
export type BubbleSize = "small" | "normal" | "large";
export type CastStyle = "office" | "neutral";
export type OfficeLanguage = "en" | "ar" | "zh-CN";

export interface OfficeSettings {
  theme: OfficeTheme;
  stuckMinutes: number;
  pollSeconds: number;
  idleRoaming: IdleRoaming;
  chatter: boolean;
  bubbles: BubbleContent;
  bubbleSize: BubbleSize;
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
}

export const DEFAULTS: OfficeSettings = {
  theme: "generated",
  stuckMinutes: 10,
  pollSeconds: 4,
  idleRoaming: "lively",
  chatter: true,
  bubbles: "activity",
  bubbleSize: "normal",
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
};

const THEMES: OfficeTheme[] = ["office", "brooklyn99", "generated"];
const ROAMING: IdleRoaming[] = ["off", "calm", "lively"];
const BUBBLES: BubbleContent[] = ["activity", "issue", "output", "none"];
const BUBBLE_SIZES: BubbleSize[] = ["small", "normal", "large"];
const CAST_STYLES: CastStyle[] = ["office", "neutral"];
const LANGUAGES: OfficeLanguage[] = ["en", "ar", "zh-CN"];

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
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
    theme: pick(r.theme, THEMES, DEFAULTS.theme),
    stuckMinutes: clamp(r.stuckMinutes, 1, 240, DEFAULTS.stuckMinutes),
    pollSeconds: clamp(r.pollSeconds, 2, 60, DEFAULTS.pollSeconds),
    idleRoaming: pick(r.idleRoaming, ROAMING, DEFAULTS.idleRoaming),
    chatter: bool(r.chatter, DEFAULTS.chatter),
    bubbles: pick(r.bubbles, BUBBLES, DEFAULTS.bubbles),
    bubbleSize: pick(r.bubbleSize, BUBBLE_SIZES, DEFAULTS.bubbleSize),
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
  };
}

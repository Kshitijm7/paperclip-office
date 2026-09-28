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
  showCost: boolean;
  costWindowDays: number;
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
  showCost: true,
  costWindowDays: 7,
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
    showCost: bool(r.showCost, DEFAULTS.showCost),
    costWindowDays: clamp(r.costWindowDays, 1, 90, DEFAULTS.costWindowDays),
    budgetAlerts: bool(r.budgetAlerts, DEFAULTS.budgetAlerts),
  };
}

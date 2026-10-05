import type { OfficeSettings } from "./settings.js";

export const SET_PREFS_ACTION = "setPrefs";
export const RESET_PREFS_ACTION = "resetPrefs";
export const PREFS_STATE_KEY = "ui-prefs";

/** Settings a viewer can flip from the gear menu; the saved value overrides the plugin config for that company. */
export const PREF_KEYS = [
  "bubbles", "nameplates", "issueTags", "stateRings", "chatter", "idleRoaming",
  "heatmap", "rosterSidebar", "activityFeed", "paEnabled", "paReports", "paIntervalMinutes", "pollSeconds", "stuckMinutes",
] as const satisfies readonly (keyof OfficeSettings)[];

export type PrefKey = (typeof PREF_KEYS)[number];
export type Prefs = Partial<Pick<OfficeSettings, PrefKey>>;

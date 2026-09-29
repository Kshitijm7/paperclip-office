// Override of upstream cafeteriaLines.ts: upstream's break-room chatter quotes The Office by name; these are neutral workplace lines.
import type { OfficeCharacterName } from "../../vendor/munder-difflin/src/renderer/src/scene/office/cast.js";

export type BreakSpot = "coffee" | "vending" | "snack" | "table";
type Exchange = readonly string[];

const pick = <T,>(arr: readonly T[], seed: number): T => arr[((seed % arr.length) + arr.length) % arr.length];

const SPOT_POOL: Record<BreakSpot, readonly string[]> = {
  coffee: ["first cup of the day", "we're out of oat milk again", "who took my mug?", "coffee first, then the backlog", "this machine needs a descale"],
  vending: ["one snack, then back to it", "the pretzels are gone again", "exact change, finally", "just browsing the options"],
  snack: ["fruit bowl is looking good", "someone brought cookies", "quick bite before standup", "saving the last apple"],
  table: ["five minutes of quiet", "reading the release notes", "thinking about that bug", "planning the afternoon"],
};

const PAIR_POOL: readonly Exchange[] = [
  ["how's the sprint going?", "better since the fix landed.", "nice, ship it."],
  ["did the build go green?", "on the second try.", "counts as a win."],
  ["lunch plans?", "the place across the street.", "save me a seat."],
  ["who's on call tonight?", "me, sadly.", "I'll bring you coffee."],
  ["that review was quick.", "small diff, happy reviewer.", "the dream."],
  ["any blockers?", "waiting on an approval.", "ping the chief."],
];

export function pickSoloLine(_character: OfficeCharacterName, spot: BreakSpot, seed: number): string {
  return pick(SPOT_POOL[spot], seed);
}

export function pickExchange(_speaker: OfficeCharacterName, seed: number): Exchange {
  return pick(PAIR_POOL, seed);
}

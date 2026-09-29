import type { OfficeCharacterName } from "../../vendor/munder-difflin/src/renderer/src/scene/office/cast.js";

// Every OFFICE_CAST member already wears a fixed outfit (portraitArt.ts RECIPES),
// so "role attire" is which cast member an agent's role maps to, not a redraw.
export type AttireCategory =
  | "chief" | "lead" | "engineer" | "designer" | "qa" | "growth" | "pa" | "writer" | "default";

const KEYWORD_RULES: Array<[RegExp, AttireCategory]> = [
  [/\b(chief|ceo)\b/i, "chief"],
  [/\b(lead|head|manager)\b/i, "lead"],
  [/\b(pa|personal assistant|assistant)\b/i, "pa"],
  [/\b(engineer|developer|dev|platform|backend|frontend|front-end|back-end)\b/i, "engineer"],
  [/\b(designer|design|ux|ui)\b/i, "designer"],
  [/\b(qa|test|quality)\b/i, "qa"],
  [/\b(growth|marketing|sales)\b/i, "growth"],
  [/\b(docs|writer|documentation)\b/i, "writer"],
];

/** Role/title -> outfit category. Order matters: first match wins. */
export function attireCategory(role: string | null | undefined, title: string | null | undefined): AttireCategory {
  const text = `${role ?? ""} ${title ?? ""}`;
  for (const [re, cat] of KEYWORD_RULES) if (re.test(text)) return cat;
  return "default";
}

// Cast members whose fixed recipe (portraitArt.ts) reads as that category's attire:
// chief/pa -> suit, lead -> shirt+tie, engineer -> polo (closest to casual/hoodie),
// designer -> colourful blouse, qa -> plain shirt (creed's blurb is literally "Quality assurance"),
// growth -> sweater/blazer-ish, writer -> cardigan.
const CATEGORY_CAST: Record<AttireCategory, OfficeCharacterName[]> = {
  chief: ["michael", "ryan"],
  lead: ["dwight", "jim", "stanley"],
  pa: ["ryan"],
  engineer: ["kevin", "andy"],
  designer: ["kelly", "phyllis", "meredith"],
  qa: ["creed", "toby"],
  growth: ["oscar"],
  writer: ["angela", "pam"],
  default: [
    "jim", "pam", "dwight", "kevin", "angela", "oscar", "stanley",
    "phyllis", "andy", "kelly", "ryan", "toby", "creed", "meredith",
  ],
};

export function attireCast(category: AttireCategory): readonly OfficeCharacterName[] {
  return CATEGORY_CAST[category];
}

/** Deterministic pick within a category's cast, keyed by a hash of the agent id. */
export function pickAttireCharacter(hashOfId: number, category: AttireCategory): OfficeCharacterName {
  const cast = CATEGORY_CAST[category];
  return cast[hashOfId % cast.length];
}

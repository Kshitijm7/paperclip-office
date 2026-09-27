import type { Agent, StatusKind } from "../adapters/store.js";
import type { AccentColorName } from "../adapters/tokens.js";
import type { OfficeAgent, OfficeData } from "../shared/office.js";

const CAST = [
  "jim", "pam", "dwight", "kevin", "angela", "oscar", "stanley",
  "phyllis", "andy", "kelly", "ryan", "toby", "creed", "meredith",
] as const;
const ACCENTS: AccentColorName[] = ["coral", "mint", "sky", "lemon", "lilac", "peach"];

export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUBBLE_CHARS = 28;

function clip(text: string): string {
  return text.length > BUBBLE_CHARS ? text.slice(0, BUBBLE_CHARS - 1) + "…" : text;
}

function sceneStatus(a: OfficeAgent): StatusKind {
  if (a.stuck) return "looping";
  if (a.justFinished) return "success";
  // Upstream's "blocked" walks the agent to the door for a human; only an approval means that here.
  if (a.state === "blocked") return a.needsApproval ? "blocked" : "waiting";
  return a.state;
}

/** Cast is assigned in id order so no two agents share a character until the cast runs out. */
export function toSceneAgents(data: OfficeData): Agent[] {
  let next = 0;
  return data.agents.map((a) => {
    const character = a.isChief ? "michael" : CAST[next++ % CAST.length];
    return {
      id: a.id,
      name: a.name,
      character,
      accent: ACCENTS[hash(a.id) % ACCENTS.length],
      description: a.title ?? a.role ?? "",
      status: sceneStatus(a),
      action: clip(a.stuck ? a.stuckReason ?? "" : a.thought ?? (a.issue ? `${a.issue.label} ${a.issue.title}` : "")),
      progress: 0,
      lastPrompt: a.issue ? clip(a.issue.title) : undefined,
      isGod: a.isChief,
    };
  });
}

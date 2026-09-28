import type { Agent, StatusKind } from "../adapters/store.js";
import type { AccentColorName } from "../adapters/tokens.js";
import type { OfficeAgent, OfficeData } from "../shared/office.js";
import { deptOrder } from "../shared/org.js";
import type { OfficeSettings } from "../shared/settings.js";

const CAST = [
  "jim", "pam", "dwight", "kevin", "angela", "oscar", "stanley",
  "phyllis", "andy", "kelly", "ryan", "toby", "creed", "meredith",
] as const;
// Every cast member is a hand-drawn Office likeness (see portraitArt.ts), so there is no
// truly neutral sprite short of a vendor edit. "Neutral" picks the least-costumed subset.
const NEUTRAL_CAST = ["kevin", "angela", "oscar", "stanley", "toby", "meredith", "phyllis"] as const;
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

/** "off" keeps every idle agent seated; "calm" keeps half of them seated, chosen deterministically by id hash. */
function seatedWhileIdle(a: OfficeAgent, idleRoaming: OfficeSettings["idleRoaming"]): boolean {
  if (idleRoaming === "off") return true;
  if (idleRoaming === "calm") return hash(a.id) % 2 === 0;
  return false;
}

function sceneStatus(a: OfficeAgent, idleRoaming: OfficeSettings["idleRoaming"]): StatusKind {
  if (a.stuck) return "looping";
  // Under an open budget incident: walk to the door, same as a pending approval.
  if (a.overBudget) return "blocked";
  if (a.justFinished) return "success";
  // Upstream's "blocked" walks the agent to the door for a human; only an approval means that here.
  if (a.state === "blocked") return a.needsApproval ? "blocked" : "waiting";
  if (a.state === "idle" && seatedWhileIdle(a, idleRoaming)) return "waiting";
  return a.state;
}

function bubbleText(a: OfficeAgent, bubbles: OfficeSettings["bubbles"]): string {
  if (bubbles === "none") return "";
  if (bubbles === "issue") return a.issue ? `${a.issue.label} ${a.issue.title}` : "";
  if (bubbles === "output") return a.thought ?? "";
  return a.stuck ? a.stuckReason ?? "" : a.thought ?? (a.issue ? `${a.issue.label} ${a.issue.title}` : "");
}

/** Departments in seating order (chief excluded: it takes desk-ceo), for the generated floor. */
export function sceneDepartments(data: OfficeData): { name: string; agentIds: string[] }[] {
  const byName = new Map<string, string[]>();
  for (const a of toSceneAgents(data)) {
    if (a.isGod) continue;
    const dept = data.agents.find((x) => x.id === a.id)!.department;
    byName.set(dept, [...(byName.get(dept) ?? []), a.id]);
  }
  return [...byName].map(([name, agentIds]) => ({ name, agentIds }));
}

/** Seats agents department by department (so teams sit together), cast assigned in that same order. */
export function toSceneAgents(data: OfficeData, settings?: OfficeSettings): Agent[] {
  const idleRoaming = settings?.idleRoaming ?? "lively";
  const bubbles = settings?.bubbles ?? "activity";
  const cast = settings?.castStyle === "neutral" ? NEUTRAL_CAST : CAST;
  const byId = new Map(data.agents.map((a) => [a.id, a]));
  const order = deptOrder(
    data.agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      title: a.title,
      reportsTo: a.reportsTo,
      status: "active",
    })),
  );
  const ordered = order.map((id) => byId.get(id)!).filter(Boolean);

  const accentByDept = new Map<string, AccentColorName>();
  for (const a of ordered) {
    if (!accentByDept.has(a.department)) accentByDept.set(a.department, ACCENTS[hash(a.department) % ACCENTS.length]);
  }

  let next = 0;
  return ordered.map((a) => {
    const character = a.isChief ? "michael" : cast[next++ % cast.length];
    return {
      id: a.id,
      name: a.name,
      character,
      accent: accentByDept.get(a.department) ?? ACCENTS[hash(a.id) % ACCENTS.length],
      description: a.title ?? a.role ?? "",
      status: sceneStatus(a, idleRoaming),
      action: clip(bubbleText(a, bubbles)),
      progress: a.progress ?? 0,
      lastPrompt: bubbles === "none" ? undefined : a.issue ? clip(a.issue.title) : undefined,
      isGod: a.isChief,
    };
  });
}

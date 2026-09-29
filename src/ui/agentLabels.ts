import { Container, Graphics, Text, Ticker } from "pixi.js";
import { useStore } from "../adapters/store.js";
import type { OfficeSettings } from "../shared/settings.js";

const TEXT_RESOLUTION = 5;
const RING_RADIUS = 9;
const ZOOM_HIDE_BELOW = 0.55;
const ZOOM_DETAIL = 1.5;
const NAME_PX = 10;
const TAG_PX = 9;

/** Anything with the two Character methods this layer needs; the real type is upstream's class. */
interface LiveCharacter {
  agentId: string;
  getPixelPosition(): { x: number; y: number };
}

const live = new Map<string, LiveCharacter>();

export function registerCharacter(agentId: string, character: LiveCharacter): void {
  live.set(agentId, character);
}

export function unregisterCharacter(agentId: string): void {
  live.delete(agentId);
}

let settings: Pick<OfficeSettings, "nameplates" | "issueTags" | "stateRings"> = {
  nameplates: true,
  issueTags: true,
  stateRings: true,
};

export function setAgentLabelSettings(s: Pick<OfficeSettings, "nameplates" | "issueTags" | "stateRings">): void {
  settings = s;
}

const RING_COLOR: Record<string, number> = {
  working: 0xd9a441,
  thinking: 0x4d96c9,
  waiting: 0x8a8a92,
  blocked: 0xd9534f,
  looping: 0xd9534f, // stuck
  compacting: 0x9b7ede,
  success: 0x6bcb77,
  idle: 0x8a8a92,
  ghost: 0x8a8a92,
};

function ringColorFor(status: string, stuck: boolean): number {
  if (stuck) return RING_COLOR.looping;
  return RING_COLOR[status] ?? RING_COLOR.idle;
}

function label(size: number, color: number, weight: "bold" | "normal" = "bold"): Text {
  const t = new Text({ text: "", style: { fontFamily: "monospace", fontSize: size, fill: color, fontWeight: weight, stroke: { color: 0x111111, width: size / 3 } } });
  t.resolution = TEXT_RESOLUTION;
  t.anchor.set(0.5, 0);
  return t;
}

const PLATE_MAX = 32;
const SHORT_MAX = 10;
const FILLER = new Set(["my", "the", "our", "a", "an", "&", "and"]);
const ABBREV: Record<string, string> = { documentation: "Docs", performance: "Perf", engineering: "Eng", engineer: "Eng", platform: "Platform", quality: "Quality", codebase: "Codebase", dispatch: "Dispatch" };

/** One or two words that tell agents apart on the canvas: "My Order Module Steward" -> "Order", "QA & Test Engineer" -> "QA Test". */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !FILLER.has(w.toLowerCase()));
  if (words.length === 0) return name.slice(0, SHORT_MAX);
  const fix = (w: string) => ABBREV[w.toLowerCase()] ?? w;
  const first = fix(words[0]);
  const short = first.length <= 3 && words[1] ? `${first} ${fix(words[1])}` : first;
  return short.length > SHORT_MAX ? short.slice(0, SHORT_MAX) : short;
}

export function plateText(name: string, role: string): string {
  const sameAsName = !role || name.toLowerCase().includes(role.toLowerCase()) || role.toLowerCase().includes(name.toLowerCase());
  const full = sameAsName ? name : `${name} · ${role}`;
  return full.length > PLATE_MAX ? `${full.slice(0, PLATE_MAX - 1).trimEnd()}…` : full;
}

interface Slot {
  container: Container;
  ring: Graphics;
  name: Text;
  tag: Text;
  flag: Graphics;
  lastNameText: string;
  lastTagText: string;
}

function drawFlag(g: Graphics): void {
  g.moveTo(0, -18).lineTo(0, -9);
  g.stroke({ width: 0.8, color: 0x5a5a5a });
  g.moveTo(0, -18).lineTo(5, -16).lineTo(0, -14).closePath();
  g.fill(0xd9534f);
}

function makeSlot(): Slot {
  const container = new Container();
  const ring = new Graphics();
  const name = label(NAME_PX, 0xf4f4f4);
  const tag = label(TAG_PX, 0xffd166);
  const flag = new Graphics();
  drawFlag(flag);
  container.addChild(ring, name, tag, flag);
  return { container, ring, name, tag, flag, lastNameText: "", lastTagText: "" };
}

/** Nameplates, issue tags and state rings that follow each agent's live sprite; mounted once
 *  per floor by the Camera override, alongside the heatmap and the wall plaque. */
export function mountAgentLabels(world: Container): void {
  const layer = new Container();
  world.addChild(layer);
  const slots = new Map<string, Slot>();

  const tick = () => {
    const agents = useStore.getState().agents;
    const seen = new Set<string>();
    const zoom = world.scale.x;
    const tooSmall = zoom < ZOOM_HIDE_BELOW;
    const detail = zoom >= ZOOM_DETAIL;
    const textScale = 1 / zoom;

    for (const a of agents) {
      const character = live.get(a.id);
      if (!character) continue;
      seen.add(a.id);
      let slot = slots.get(a.id);
      if (!slot) {
        slot = makeSlot();
        slots.set(a.id, slot);
        layer.addChild(slot.container);
      }

      const pos = character.getPixelPosition();
      slot.container.position.set(pos.x, pos.y);
      slot.container.visible = !tooSmall;
      if (tooSmall) continue;

      slot.ring.visible = settings.stateRings;
      if (settings.stateRings) {
        slot.ring.clear();
        const color = ringColorFor(String(a.status ?? "idle"), Boolean((a as { stuck?: unknown }).stuck) || a.status === "looping");
        slot.ring.ellipse(0, 2, RING_RADIUS, RING_RADIUS / 3).stroke({ width: 1.4, color, alpha: 0.9 });
      }

      const scores = (a as { scores?: { flag?: string | null } | null }).scores;
      slot.flag.visible = Boolean(scores?.flag);

      slot.name.visible = settings.nameplates;
      if (settings.nameplates) {
        const text = shortName(a.name);
        if (text !== slot.lastNameText) {
          slot.name.text = text;
          slot.lastNameText = text;
        }
        slot.name.scale.set(textScale);
        slot.name.position.set(0, 5);
      }

      const issueLabel = (a as { issueLabel?: unknown }).issueLabel;
      const issueTitle = (a as { issueTitle?: unknown }).issueTitle;
      const showTag = settings.issueTags && typeof issueLabel === "string" && a.status !== "idle" && a.status !== "waiting" && a.status !== "ghost" && detail;
      slot.tag.visible = showTag;
      if (showTag) {
        const rawTitle = typeof issueTitle === "string" ? issueTitle : "";
        const combined = `${issueLabel} ${rawTitle}`.trim();
        const text = combined.length > 26 ? combined.slice(0, 25) + "…" : combined;
        if (text !== slot.lastTagText) {
          slot.tag.text = text;
          slot.lastTagText = text;
        }
        slot.tag.scale.set(textScale);
        slot.tag.position.set(0, 5 + (settings.nameplates ? (NAME_PX + 2) * textScale : 0));
      }
    }

    for (const [id, slot] of slots) {
      if (seen.has(id)) continue;
      slot.container.destroy({ children: true });
      slots.delete(id);
    }
  };

  Ticker.shared.add(tick);
  layer.once("destroyed", () => Ticker.shared.remove(tick));
}

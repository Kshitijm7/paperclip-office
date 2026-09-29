import { Container, Graphics, Text, Ticker } from "pixi.js";
import { useStore } from "../adapters/store.js";
import type { OfficeSettings } from "../shared/settings.js";

const TEXT_RESOLUTION = 5;
const RING_RADIUS = 9;
const ZOOM_HIDE_BELOW = 0.55;

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
  const t = new Text({ text: "", style: { fontFamily: "monospace", fontSize: size, fill: color, fontWeight: weight } });
  t.resolution = TEXT_RESOLUTION;
  t.anchor.set(0.5, 0);
  return t;
}

interface Slot {
  container: Container;
  ring: Graphics;
  name: Text;
  tag: Text;
  lastNameText: string;
  lastTagText: string;
}

function makeSlot(): Slot {
  const container = new Container();
  const ring = new Graphics();
  const name = label(3.4, 0xf4f4f4);
  const tag = label(3, 0xffe08a);
  container.addChild(ring, name, tag);
  return { container, ring, name, tag, lastNameText: "", lastTagText: "" };
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

      slot.name.visible = settings.nameplates;
      if (settings.nameplates) {
        const roleShort = String((a as { roleShort?: unknown }).roleShort ?? "");
        const text = roleShort ? `${a.name} · ${roleShort}` : a.name;
        if (text !== slot.lastNameText) {
          slot.name.text = text;
          slot.lastNameText = text;
        }
        slot.name.position.set(0, 10);
      }

      const issueLabel = (a as { issueLabel?: unknown }).issueLabel;
      const issueTitle = (a as { issueTitle?: unknown }).issueTitle;
      const showTag = settings.issueTags && typeof issueLabel === "string" && a.status !== "idle" && a.status !== "waiting" && a.status !== "ghost";
      slot.tag.visible = showTag;
      if (showTag) {
        const rawTitle = typeof issueTitle === "string" ? issueTitle : "";
        const combined = `${issueLabel} ${rawTitle}`.trim();
        const text = combined.length > 26 ? combined.slice(0, 25) + "…" : combined;
        if (text !== slot.lastTagText) {
          slot.tag.text = text;
          slot.lastTagText = text;
        }
        slot.tag.position.set(0, -40);
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

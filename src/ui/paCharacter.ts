import { Container, Graphics, Text, Ticker } from "pixi.js";
import { CharacterSprite, type Direction } from "../../vendor/munder-difflin/src/renderer/src/scene/office/CharacterSprite.js";
import { loadTheme } from "../overrides/themeLoader.js";
import { attireCast } from "../shared/roleAttire.js";
import { useStore } from "../adapters/store.js";
import { deskVisitOrder } from "../layout/seatAssignment.js";
import { getEntranceTile, getSceneTileSize, getSeatAssignments, findWalkPath } from "./seatMap.js";
import type { Tile } from "../layout/seatAssignment.js";
import type { OfficeSettings } from "../shared/settings.js";

const SPEED = 48; // px/sec, matches vendor Character's walk speed
const VISIT_SECONDS = 3;
const NAME = "PA";

let paEnabled = true;

export function setPaSettings(s: Pick<OfficeSettings, "paEnabled">): void {
  paEnabled = s.paEnabled;
}

function tileToPixel(t: Tile, ts: number): { x: number; y: number } {
  return { x: t.x * ts + ts / 2, y: t.y * ts + ts };
}

function pixelToTile(x: number, y: number, ts: number): Tile {
  return { x: Math.floor(x / ts), y: Math.floor((y - ts / 2) / ts) };
}

function messageFor(agent: { scores?: { flag?: string | null } | null; issueLabel?: string | null }): string {
  const flag = agent.scores?.flag;
  if (flag) return flag;
  return agent.issueLabel ? `Status on ${agent.issueLabel}?` : "Status update?";
}

type Phase = "spawning" | "walking" | "visiting";

/** A synthetic PA that walks the floor visiting every agent's desk in order and drops a status
 *  bubble beside each one. Draws its own Graphics figure (no vendor Character/cast involved), so
 *  it never claims a seat, never joins the store's agent list, and stays out of every board that
 *  reads that list (counts, roster, scoreboard, search, Wall of Fame). Mounted once per floor by
 *  the Camera override, alongside the heatmap and nameplate layers. */
function directionTo(x: number, y: number, p: { x: number; y: number }): Direction {
  const dx = p.x - x;
  const dy = p.y - y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export function mountPa(world: Container): void {
  const layer = new Container();
  layer.visible = false;
  world.addChild(layer);

  const body = new Container();
  let sprite: CharacterSprite | null = null;
  let anim = "";
  void loadTheme(useStore.getState().officeTheme).then(async (theme) => {
    const frames = await theme.cast.getFrames(attireCast("pa")[0]);
    if (layer.destroyed) return;
    sprite = new CharacterSprite(frames);
    body.addChild(sprite.container);
  });

  const name = new Text({ text: NAME, style: { fontFamily: "monospace", fontSize: 10, fill: 0xffd166, fontWeight: "bold", stroke: { color: 0x111111, width: 3 } } });
  name.resolution = 5;
  name.anchor.set(0.5, 0);

  const bubble = new Container();
  const bubbleBg = new Graphics();
  const bubbleText = new Text({ text: "", style: { fontFamily: "monospace", fontSize: 10, fill: 0x2a2a2a, fontWeight: "bold" } });
  bubbleText.resolution = 5;
  bubbleText.anchor.set(0.5, 0.5);
  bubble.addChild(bubbleBg, bubbleText);

  layer.addChild(body, name, bubble);

  let px = 0;
  let py = 0;
  let path: Tile[] = [];
  let visitIndex = 0;
  let phase: Phase = "spawning";
  let visitTimer = 0;

  const tick = (ticker: Ticker) => {
    if (!paEnabled) {
      layer.visible = false;
      phase = "spawning";
      return;
    }
    const ts = getSceneTileSize();
    const agents = useStore.getState().agents;
    const seats = getSeatAssignments(agents.map((a) => ({ id: a.id, isChief: !!a.isGod })));
    const order = deskVisitOrder(agents.map((a) => a.id), seats);
    if (order.length === 0) {
      layer.visible = false;
      return;
    }
    if (visitIndex >= order.length) visitIndex = 0;

    if (phase === "spawning") {
      const start = getEntranceTile() ?? seats.get(order[0])!;
      const p = tileToPixel(start, ts);
      px = p.x;
      py = p.y;
      layer.visible = true;
      phase = "walking";
      path = [];
    }

    const dt = ticker.deltaMS / 1000;
    const byId = new Map(agents.map((a) => [a.id, a]));

    if (phase === "walking") {
      if (path.length === 0) {
        const target = seats.get(order[visitIndex]);
        const from = pixelToTile(px, py, ts);
        path = (target && findWalkPath(from, target)) ?? [];
        if (path.length === 0 && target && (from.x !== target.x || from.y !== target.y)) path = [target];
        if (path.length === 0) {
          phase = "visiting";
          visitTimer = 0;
        }
      } else {
        const next = path[0];
        const p = tileToPixel(next, ts);
        const dx = p.x - px;
        const dy = p.y - py;
        const dist = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (dist <= step) {
          px = p.x;
          py = p.y;
          path.shift();
          if (path.length === 0) {
            phase = "visiting";
            visitTimer = 0;
          }
        } else {
          px += (dx / dist) * step;
          py += (dy / dist) * step;
        }
      }
    } else if (phase === "visiting") {
      visitTimer += dt;
      if (visitTimer >= VISIT_SECONDS) {
        visitIndex = (visitIndex + 1) % order.length;
        phase = "walking";
      }
    }

    layer.position.set(px, py);
    const visiting = phase === "visiting";
    const walkDir: Direction = path.length ? directionTo(px, py, tileToPixel(path[0], ts)) : "down";
    const nextAnim = visiting ? "idle:down" : `walk:${walkDir}`;
    if (sprite && nextAnim !== anim) {
      const [a, d] = nextAnim.split(":") as ["idle" | "walk", Direction];
      sprite.setAnimation(a, d);
      anim = nextAnim;
    }
    const inv = 1 / world.scale.x;
    name.scale.set(inv);
    name.position.set(0, 4);
    bubble.scale.set(inv);
    bubble.position.set(0, -34);
    bubble.visible = visiting;
    if (visiting) {
      const agent = byId.get(order[visitIndex]);
      const msg = agent ? messageFor(agent as { scores?: { flag?: string | null } | null; issueLabel?: string | null }) : "Status update?";
      if (bubbleText.text !== msg) bubbleText.text = msg;
      const w = bubbleText.width + 14;
      bubbleBg.clear().roundRect(-w / 2, -11, w, 22, 6).fill({ color: 0xfff6d8, alpha: 0.97 }).stroke({ width: 1.5, color: 0xb23a3a });
    }
  };

  Ticker.shared.add(tick);
  layer.once("destroyed", () => Ticker.shared.remove(tick));
}

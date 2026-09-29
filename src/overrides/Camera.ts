// Override of upstream Camera.ts: registers the live camera so the UI can return to the whole-floor view,
// and turns the select nudge into a zoom on the agent.
import { mountPlaque } from "../ui/wallPlaque.js";
import { mountHeatmap } from "../ui/heatmapLayer.js";
import { mountAgentLabels } from "../ui/agentLabels.js";
import { mountPa } from "../ui/paCharacter.js";
import { mountReceptionist } from "../ui/receptionist.js";
import { Camera as UpstreamCamera } from "../../vendor/munder-difflin/src/renderer/src/scene/office/Camera.js";
import { Container, Graphics, Ticker } from "pixi.js";
import { getSceneTileSize } from "../ui/seatMap.js";

/** Upstream pins its ASK ME board at office.tmj tile (14, 10), which lands mid-room on a generated floor; Decisions covers it. */
function hideAskBoard(world: Container): void {
  const find = (c: Container): Graphics | undefined => {
    const ts = getSceneTileSize();
    for (const ch of c.children) {
      if (ch instanceof Graphics && ch.cursor === "pointer" && ch.x === 14 * ts + 25 && ch.y === 10 * ts) return ch;
      if (ch instanceof Container) { const hit = find(ch); if (hit) return hit; }
    }
    return undefined;
  };
  const tick = () => {
    const board = find(world);
    if (!board) return;
    board.visible = false;
    board.eventMode = "none";
    Ticker.shared.remove(tick);
  };
  Ticker.shared.add(tick);
  world.once("destroyed", () => Ticker.shared.remove(tick));
}

export const SELECT_ZOOM = 2;
let active: UpstreamCamera | null = null;

export class Camera extends UpstreamCamera {
  constructor(...args: ConstructorParameters<typeof UpstreamCamera>) {
    super(...args);
    active = this;
    mountHeatmap(args[0]);
    mountPlaque(args[0]);
    mountAgentLabels(args[0]);
    mountPa(args[0]);
    hideAskBoard(args[0]);
    mountReceptionist(args[0]);
  }

  override nudgeToward(worldX: number, worldY: number): void {
    this.focusOn(worldX, worldY, SELECT_ZOOM);
  }
}

/** God's-eye view: fit the whole floor, and keep fitting on resize. */
export function fitWholeFloor(): void {
  active?.fitToScreen();
}

export const ZOOM_STEP = 1.4;

/** Zooms around the current view centre; factor > 1 zooms in. */
export function zoomBy(factor: number): void {
  const cam = active as unknown as { targetX: number; targetY: number; targetZoom: number } | null;
  if (cam) active!.focusOn(cam.targetX, cam.targetY, cam.targetZoom * factor);
}

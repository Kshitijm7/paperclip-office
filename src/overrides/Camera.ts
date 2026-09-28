// Override of upstream Camera.ts: registers the live camera so the UI can return to the whole-floor view,
// and turns the select nudge into a zoom on the agent.
import { mountPlaque } from "../ui/wallPlaque.js";
import { Camera as UpstreamCamera } from "../../vendor/munder-difflin/src/renderer/src/scene/office/Camera.js";

export const SELECT_ZOOM = 2;
let active: UpstreamCamera | null = null;

export class Camera extends UpstreamCamera {
  constructor(...args: ConstructorParameters<typeof UpstreamCamera>) {
    super(...args);
    active = this;
    mountPlaque(args[0]);
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

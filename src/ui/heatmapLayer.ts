import { Container, Graphics } from "pixi.js";
import { useStore } from "../adapters/store.js";
import { getSeatAssignments, getSceneTileSize } from "./seatMap.js";
import { tokens } from "./tokens.js";
import type { OfficeSettings } from "../shared/settings.js";

let heatmapEnabled = true;
let heatLow = 2;
let heatHigh = 5;

export function setHeatmapSettings(settings: Pick<OfficeSettings, "heatmap" | "heatLow" | "heatHigh">): void {
  heatmapEnabled = settings.heatmap;
  heatLow = settings.heatLow;
  heatHigh = settings.heatHigh;
  redraw?.();
}

function colorFor(depth: number): number {
  if (depth >= heatHigh) return tokens.heat.high;
  if (depth >= heatLow) return tokens.heat.mid;
  return tokens.heat.low;
}

let redraw: (() => void) | null = null;

/** Translucent rug under every occupied desk, colored by that agent's queue depth. Mounted
 *  once per floor by the Camera override, right after the floor so it sits under characters. */
export function mountHeatmap(world: Container): void {
  const layer = new Container();
  world.addChildAt(layer, Math.min(1, world.children.length));

  const draw = () => {
    layer.removeChildren();
    if (!heatmapEnabled) return;
    const ts = getSceneTileSize();
    const agents = useStore.getState().agents;
    const seats = getSeatAssignments(agents.map((a) => ({ id: a.id, isChief: !!a.isGod })));
    for (const a of agents) {
      const tile = seats.get(a.id);
      if (!tile) continue;
      const depth = typeof a.queueDepth === "number" ? a.queueDepth : 0;
      const rug = new Graphics().rect(1, 1, ts - 2, ts - 2).fill({ color: colorFor(depth), alpha: tokens.heat.alpha });
      rug.position.set(tile.x * ts, tile.y * ts);
      layer.addChild(rug);
    }
  };
  redraw = draw;
  draw();

  const unsubscribe = useStore.subscribe(draw);
  layer.once("destroyed", () => {
    unsubscribe();
    if (redraw === draw) redraw = null;
  });
}

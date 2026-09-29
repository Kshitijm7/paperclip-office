import { Container, Graphics, Rectangle, Text } from "pixi.js";
import { CharacterSprite } from "../../vendor/munder-difflin/src/renderer/src/scene/office/CharacterSprite.js";
import { loadTheme } from "../overrides/themeLoader.js";
import { useStore } from "../adapters/store.js";
import { getSceneTileSize, getSpawnTile } from "./seatMap.js";

const GREETING = "Welcome in! Who are you here to see?";

/** A receptionist who always sits at the front desk and greets whoever hovers over her. Like the PA she is drawn
 *  here, not by the store, so she never claims a seat or shows up in counts, roster or scoreboard. */
export function mountReceptionist(world: Container): void {
  const tile = getSpawnTile("reception-desk");
  if (!tile) return;
  const ts = getSceneTileSize();

  const layer = new Container();
  layer.position.set(tile.x * ts + ts / 2, tile.y * ts + ts);
  layer.eventMode = "static";
  layer.cursor = "pointer";
  layer.hitArea = new Rectangle(-ts / 2, -ts * 2, ts, ts * 2);
  world.addChild(layer);

  void loadTheme(useStore.getState().officeTheme).then(async (theme) => {
    const frames = await theme.cast.getFrames("pam");
    if (layer.destroyed) return;
    const sprite = new CharacterSprite(frames);
    sprite.setAnimation("idle", "down");
    layer.addChildAt(sprite.container, 0);
  });

  const bubble = new Container();
  const bg = new Graphics();
  const text = new Text({ text: GREETING, style: { fontFamily: "monospace", fontSize: 10, fill: 0x2a2a2a, fontWeight: "bold" } });
  text.resolution = 5;
  text.anchor.set(0.5, 0.5);
  const w = text.width + 14;
  bg.roundRect(-w / 2, -11, w, 22, 6).fill({ color: 0xfff6d8, alpha: 0.97 }).stroke({ width: 1.5, color: 0x6b8f71 });
  bubble.addChild(bg, text);
  bubble.position.set(0, -ts * 2 - 8);
  bubble.visible = false;
  layer.addChild(bubble);

  const scaleBubble = () => bubble.scale.set(1 / world.scale.x);
  layer.on("pointerover", () => { scaleBubble(); bubble.visible = true; });
  layer.on("pointerout", () => { bubble.visible = false; });
}

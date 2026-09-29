import * as upstream from "../../vendor/munder-difflin/src/renderer/src/design/tokens.js";

export { colors, space, tileSize, accentByName, accentLightByName, hex } from "../../vendor/munder-difflin/src/renderer/src/design/tokens.js";
export type { AccentColorName } from "../../vendor/munder-difflin/src/renderer/src/design/tokens.js";

const HOST_UI = 'var(--font-sans, ui-sans-serif), system-ui, -apple-system, "Segoe UI", sans-serif';

export const type = {
  ...upstream.type,
  ui: HOST_UI,
  mono: 'var(--font-mono, ui-monospace), "SF Mono", Menlo, monospace',
} as const;

// Override of upstream themeLoader.ts: adds the org-chart "generated" (LimeZu) and "free" (Scandi wood) themes, delegates every other id upstream.
import { loadTheme as upstreamLoadTheme } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeLoader.js";
import type { ThemeConfig, ThemeId } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeRegistry.js";
import { getGeneratedDepartments, getGeneratedSpec } from "../layout/provider.js";
import { buildFreeTheme, buildGeneratedTheme, FREE_THEME_ID, GENERATED_THEME_ID } from "../layout/theme.js";

import { resolveThemeMap as upstreamResolveThemeMap } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeLoader.js";
import { setSceneMap } from "../ui/wallPlaque.js";
import { setSeatSceneMap } from "../ui/seatMap.js";

export { themeTilesetUrls } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeLoader.js";

// Records the map the floor is about to render so the wall plaque can find free wall, and so the
// heatmap layer can resolve the same desk tiles upstream's OfficeFloor claims.
export function resolveThemeMap(theme: ThemeConfig): ReturnType<typeof upstreamResolveThemeMap> {
  const map = upstreamResolveThemeMap(theme);
  setSceneMap(map);
  setSeatSceneMap(map, theme.primarySeatNames);
  return map;
}

export async function loadTheme(id: ThemeId): Promise<ThemeConfig> {
  if (id !== GENERATED_THEME_ID && id !== FREE_THEME_ID) return upstreamLoadTheme(id);
  try {
    const build = id === FREE_THEME_ID ? buildFreeTheme : buildGeneratedTheme;
    return build(getGeneratedDepartments(), getGeneratedSpec());
  } catch (err) {
    console.warn("[themeLoader] generated theme failed, falling back to 'office'", err);
    return upstreamLoadTheme("office");
  }
}

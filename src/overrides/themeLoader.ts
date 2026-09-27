// Override of upstream themeLoader.ts: adds the org-chart "generated" theme, delegates every other id upstream.
import { loadTheme as upstreamLoadTheme } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeLoader.js";
import type { ThemeConfig, ThemeId } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeRegistry.js";
import { getGeneratedDepartments } from "../layout/provider.js";
import { buildGeneratedTheme, GENERATED_THEME_ID } from "../layout/theme.js";

export { resolveThemeMap, themeTilesetUrls } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeLoader.js";

export async function loadTheme(id: ThemeId): Promise<ThemeConfig> {
  if (id !== GENERATED_THEME_ID) return upstreamLoadTheme(id);
  try {
    return buildGeneratedTheme(getGeneratedDepartments());
  } catch (err) {
    console.warn("[themeLoader] generated theme failed, falling back to 'office'", err);
    return upstreamLoadTheme("office");
  }
}

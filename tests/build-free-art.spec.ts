import esbuild from "esbuild";
import { describe, expect, it } from "vitest";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
// @ts-expect-error plain .mjs build helper without types
import { hasLimezu, upstreamAliases } from "../scripts/esbuild-aliases.mjs";
import { availableTheme } from "../src/shared/art.js";
import { KENNEY_TILESETS, kenneyPalette } from "../src/layout/kenney.js";
import { generateOfficeMap } from "../src/layout/generate.js";

const MISSING = "assets/does-not-exist";

describe("build without assets/local", () => {
  it("bundles the UI with stubbed LimeZu imports and the free atlases inlined", async () => {
    expect(hasLimezu(MISSING)).toBe(false);
    const ui = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" }).esbuild.ui as esbuild.BuildOptions;
    const out = await esbuild.build({
      ...ui,
      write: false,
      logLevel: "silent",
      define: { ...(ui.define ?? {}), __LIMEZU__: "false" },
      plugins: [...(ui.plugins ?? []), upstreamAliases(MISSING)],
    });
    expect(out.errors).toEqual([]);
    const js = out.outputFiles.filter((f) => f.path.endsWith(".js")).map((f) => f.text).join("\n");
    expect(js).toContain("data:image/png;base64,");
  }, 60_000);

  it("falls back to the free theme", () => {
    expect(availableTheme("generated", false)).toBe("free");
    expect(availableTheme("generated", true)).toBe("generated");
  });
});

describe("kenney palette", () => {
  it("only draws gids that exist in the packed atlases", () => {
    const last = KENNEY_TILESETS[1].firstgid + KENNEY_TILESETS[1].tilecount - 1;
    const { map } = generateOfficeMap([{ name: "a", agentIds: ["1", "2", "3", "4", "5", "6"] }], kenneyPalette());
    for (const l of map.layers) if (l.data && l.name !== "collision") for (const g of l.data) expect(g >= 0 && g <= last, `${l.name} ${g}`).toBe(true);
  });
});

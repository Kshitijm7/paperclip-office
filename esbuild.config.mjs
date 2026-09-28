import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
import { hasLimezu, upstreamAliases } from "./scripts/esbuild-aliases.mjs";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");
const artDir = process.env.OFFICE_ART_DIR || "assets/local";
const limezu = hasLimezu(artDir);
if (!limezu) console.warn(`build: no LimeZu art in ${artDir}; only the free (Kenney) theme will be offered.`);

const ui = {
  ...presets.esbuild.ui,
  define: { ...(presets.esbuild.ui.define ?? {}), __LIMEZU__: String(limezu) },
  plugins: [...(presets.esbuild.ui.plugins ?? []), upstreamAliases(artDir)],
};

const workerCtx = await esbuild.context(presets.esbuild.worker);
const manifestCtx = await esbuild.context(presets.esbuild.manifest);
const uiCtx = await esbuild.context(ui);

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()]);
  console.log("esbuild watch mode enabled for worker, manifest, and ui");
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose(), uiCtx.dispose()]);
}

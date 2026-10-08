import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";
import { hasLimezu, upstreamAliases } from "./scripts/esbuild-aliases.mjs";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");
const artDir = process.env.OFFICE_ART_DIR || "assets/local";
const limezu = hasLimezu(artDir);
if (!limezu) console.warn(`build: no LimeZu art in ${artDir}; only the free (Kenney) theme will be offered.`);

// View-only mode: OFFICE_VIEW_ONLY=1 npm run build bakes the switch into the
// manifest and worker bundles. Runtime OFFICE_VIEW_ONLY still applies to the
// worker, so an env-only start also works without a rebuild.
const viewOnly = /^(1|true|yes)$/i.test(process.env.OFFICE_VIEW_ONLY ?? "");
if (viewOnly) console.warn("build: view-only mode ON — the package asks for read permissions only and carries no write features.");
const viewOnlyDefine = { "process.env.OFFICE_VIEW_ONLY_BUILD": JSON.stringify(viewOnly ? "1" : "") };

const ui = {
  ...presets.esbuild.ui,
  define: { ...(presets.esbuild.ui.define ?? {}), __LIMEZU__: String(limezu) },
  plugins: [...(presets.esbuild.ui.plugins ?? []), upstreamAliases(artDir)],
};

const worker = { ...presets.esbuild.worker, define: { ...(presets.esbuild.worker.define ?? {}), ...viewOnlyDefine } };
const manifest = { ...presets.esbuild.manifest, define: { ...(presets.esbuild.manifest.define ?? {}), ...viewOnlyDefine } };

const workerCtx = await esbuild.context(worker);
const manifestCtx = await esbuild.context(manifest);
const uiCtx = await esbuild.context(ui);

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()]);
  console.log("esbuild watch mode enabled for worker, manifest, and ui");
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose(), uiCtx.dispose()]);
}

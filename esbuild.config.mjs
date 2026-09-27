import esbuild from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");

const VENDOR = resolve("vendor/munder-difflin/src/renderer/src");
const ADAPTERS = {
  "@/store/store": resolve("src/adapters/store.ts"),
  "@/design/tokens": resolve("src/adapters/tokens.ts"),
  "react-i18next": resolve("src/adapters/i18n.ts"),
};

// Redirects upstream's `@/` imports to our adapters, falling back to vendor/; serves `?raw` and `?url` assets.
const upstreamAliases = {
  name: "upstream-aliases",
  setup(build) {
    build.onResolve({ filter: /^(@\/|react-i18next$)/ }, (args) => {
      const [spec, query] = args.path.split("?");
      if (spec.startsWith("@/assets/")) {
        return { path: resolve("assets/local", spec.slice("@/assets/".length)), namespace: `asset-${query}` };
      }
      if (ADAPTERS[spec]) return { path: ADAPTERS[spec] };
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const file = resolve(VENDOR, spec.slice(2) + ext);
        if (existsSync(file)) return { path: file };
      }
      return undefined;
    });
    build.onLoad({ filter: /.*/, namespace: "asset-raw" }, (args) => ({
      contents: readFileSync(args.path, "utf8"),
      loader: "text",
    }));
    // The host loads plugin UI from a blob URL, so relative asset URLs cannot resolve; inline them.
    build.onLoad({ filter: /.*/, namespace: "asset-url" }, (args) => ({
      contents: readFileSync(args.path),
      loader: "dataurl",
    }));
  },
};

const ui = { ...presets.esbuild.ui, plugins: [...(presets.esbuild.ui.plugins ?? []), upstreamAliases] };

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

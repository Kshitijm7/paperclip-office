import esbuild from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasLimezu, upstreamAliases } from "../scripts/esbuild-aliases.mjs";

import { readFileSync, writeFileSync } from "node:fs";

mkdirSync(resolve("demo/dist"), { recursive: true });
const html = readFileSync(resolve("demo/index.html"), "utf8").replace("BUILD_ID", String(Date.now()));
writeFileSync(resolve("demo/dist/index.html"), html);

// DEMO_ART=assets/local renders with your own LimeZu art (screenshots only; never publish that build).
const artDir = resolve(process.env.DEMO_ART || "demo/.no-art");
const limezu = hasLimezu(artDir);

const sdkMockPlugin = {
  name: "sdk-mock",
  setup(build) {
    build.onResolve({ filter: /^@paperclipai\/plugin-sdk\/ui$/ }, () => ({ path: resolve("demo/sdk-mock.tsx") }));
  },
};

await esbuild.build({
  entryPoints: ["demo/entry.tsx"],
  outfile: "demo/dist/bundle.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  jsx: "automatic",
  define: { __LIMEZU__: String(limezu), "process.env.NODE_ENV": '"production"' },
  plugins: [sdkMockPlugin, upstreamAliases(artDir)],
  loader: { ".png": "dataurl" },
});

console.log("demo build: OK -> demo/dist/bundle.js");

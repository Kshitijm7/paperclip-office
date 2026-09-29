import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const VENDOR = resolve("vendor/munder-difflin/src/renderer/src");
const ADAPTERS = {
  "@/store/store": resolve("src/adapters/store.ts"),
  "@/design/tokens": resolve("src/adapters/tokens.ts"),
  "react-i18next": resolve("src/adapters/i18n.ts"),
};

/** LimeZu art is present when fetch-art (or the user) filled the art dir. */
export const hasLimezu = (artDir = "assets/local") => existsSync(resolve(artDir, "maps/office.tmj"));

// Redirects upstream's `@/` imports to our adapters, falling back to vendor/; serves `?raw` and `?url` assets.
// Missing LimeZu files resolve to empty stubs so the build works with only the committed free art.
export function upstreamAliases(artDir = "assets/local") {
  return {
    name: "upstream-aliases",
    setup(build) {
      // File overrides (upstream/overrides.md): swap single vendor modules for src/overrides/ when vendor imports them.
      build.onResolve({ filter: /^\.\/(themeLoader|Camera)$/ }, (args) =>
        args.importer.startsWith(VENDOR) ? { path: resolve("src/overrides", args.path.slice(2) + ".ts") } : undefined,
      );
      build.onResolve({ filter: /^(@\/|react-i18next$)/ }, (args) => {
        const [spec, query] = args.path.split("?");
        if (spec.startsWith("@/assets/")) {
          const file = resolve(artDir, spec.slice("@/assets/".length));
          return { path: file, namespace: existsSync(file) ? `asset-${query}` : "asset-stub" };
        }
        if (ADAPTERS[spec]) return { path: ADAPTERS[spec] };
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          const file = resolve(VENDOR, spec.slice(2) + ext);
          if (existsSync(file)) return { path: file };
        }
        return undefined;
      });
      // Our own relative asset imports (the committed Kenney atlases).
      build.onResolve({ filter: /^\.{1,2}\/.*\?(url|raw)$/ }, (args) => {
        const [spec, query] = args.path.split("?");
        return { path: resolve(dirname(args.importer), spec), namespace: `asset-${query}` };
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
      build.onLoad({ filter: /.*/, namespace: "asset-stub" }, () => ({ contents: "", loader: "text" }));
    },
  };
}

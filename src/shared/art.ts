declare const __LIMEZU__: boolean | undefined;

/** False when the UI was built without assets/local (esbuild defines __LIMEZU__); tests and the worker assume true. */
export const HAS_LIMEZU: boolean = typeof __LIMEZU__ === "undefined" ? true : __LIMEZU__;

/** Themes drawn from LimeZu art fall back to the free Kenney theme when that art is missing. */
export function availableTheme<T extends string>(theme: T, hasLimezu = HAS_LIMEZU): T | "free" {
  return hasLimezu ? theme : "free";
}

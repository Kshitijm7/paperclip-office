import { describe, expect, it } from "vitest";
import { DEFAULTS, normalize } from "../src/shared/settings.js";
import { PA_PREF_KEYS, PREF_KEYS } from "../src/shared/prefs.js";

describe("view-only mode", () => {
  it("is off by default so a normal install keeps every feature", () => {
    expect(DEFAULTS.viewOnly).toBe(false);
    expect(normalize(undefined).viewOnly).toBe(false);
    expect(normalize({}).viewOnly).toBe(false);
  });

  it("honours an explicit viewOnly config and rejects non-boolean values", () => {
    expect(normalize({ viewOnly: true }).viewOnly).toBe(true);
    expect(normalize({ viewOnly: false }).viewOnly).toBe(false);
  });

  it("keeps the PA out of the viewer preferences", () => {
    for (const k of PA_PREF_KEYS) expect(PREF_KEYS).not.toContain(k);
    expect(PREF_KEYS).toContain("bubbles");
  });
});

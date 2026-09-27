import { describe, expect, it } from "vitest";
import { DEFAULTS, normalize } from "../src/shared/settings.js";

describe("normalize", () => {
  it("fills in every field from an empty/undefined config", () => {
    expect(normalize(undefined)).toEqual(DEFAULTS);
    expect(normalize({})).toEqual(DEFAULTS);
  });

  it("clamps stuckMinutes and pollSeconds to their ranges", () => {
    expect(normalize({ stuckMinutes: 0 }).stuckMinutes).toBe(1);
    expect(normalize({ stuckMinutes: 9999 }).stuckMinutes).toBe(240);
    expect(normalize({ pollSeconds: 1 }).pollSeconds).toBe(2);
    expect(normalize({ pollSeconds: 999 }).pollSeconds).toBe(60);
  });

  it("falls back to the default for an out-of-range enum", () => {
    expect(normalize({ theme: "bogus" }).theme).toBe("office");
    expect(normalize({ idleRoaming: "bogus" }).idleRoaming).toBe("lively");
    expect(normalize({ bubbles: "bogus" }).bubbles).toBe("activity");
    expect(normalize({ language: "fr" }).language).toBe("en");
  });

  it("passes through valid enum values", () => {
    expect(normalize({ theme: "brooklyn99" }).theme).toBe("brooklyn99");
    expect(normalize({ language: "zh-CN" }).language).toBe("zh-CN");
    expect(normalize({ castStyle: "neutral" }).castStyle).toBe("neutral");
  });

  it("coerces non-boolean values for boolean fields", () => {
    expect(normalize({ chatter: "yes" }).chatter).toBe(true);
    expect(normalize({ chatter: false }).chatter).toBe(false);
    expect(normalize({ showOrgPanel: 0 }).showOrgPanel).toBe(true);
  });
});

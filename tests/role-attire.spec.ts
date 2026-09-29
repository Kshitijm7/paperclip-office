import { describe, expect, it } from "vitest";
import { attireCategory, attireCast, pickAttireCharacter } from "../src/shared/roleAttire.js";

describe("attireCategory", () => {
  it("maps chief/ceo titles", () => {
    expect(attireCategory("ceo", null)).toBe("chief");
    expect(attireCategory(null, "Chief Executive")).toBe("chief");
  });

  it("maps engineering roles to the engineer category", () => {
    for (const role of ["engineer", "developer", "backend", "frontend", "platform"]) {
      expect(attireCategory(role, null)).toBe("engineer");
    }
  });

  it("maps design roles", () => {
    expect(attireCategory("designer", null)).toBe("designer");
    expect(attireCategory(null, "UX Lead")).toBe("lead"); // "lead" keyword wins over "ux"
  });

  it("maps QA and growth", () => {
    expect(attireCategory("qa", null)).toBe("qa");
    expect(attireCategory("growth", null)).toBe("growth");
    expect(attireCategory("marketing", null)).toBe("growth");
  });

  it("maps a PA/assistant role", () => {
    expect(attireCategory("PA", null)).toBe("pa");
    expect(attireCategory(null, "Personal Assistant")).toBe("pa");
  });

  it("falls back to default for an unrecognized role", () => {
    expect(attireCategory("unicorn wrangler", null)).toBe("default");
    expect(attireCategory(null, null)).toBe("default");
  });
});

describe("pickAttireCharacter", () => {
  it("is deterministic for the same hash and category", () => {
    const a = pickAttireCharacter(42, "engineer");
    const b = pickAttireCharacter(42, "engineer");
    expect(a).toBe(b);
  });

  it("only picks from that category's cast", () => {
    for (let h = 0; h < 20; h++) {
      expect(attireCast("chief")).toContain(pickAttireCharacter(h, "chief"));
      expect(attireCast("qa")).toContain(pickAttireCharacter(h, "qa"));
    }
  });
});

import { describe, expect, it } from "vitest";
import { plateText } from "../src/ui/agentLabels.js";

describe("plateText", () => {
  it("adds the role when it differs from the name", () => {
    expect(plateText("Sara Chen", "Backend Engineer")).toBe("Sara Chen · Backend Engineer");
  });
  it("shows the name once when the name is the role", () => {
    const text = plateText("Codebase Quality & Structure Manager", "Codebase Quality & Structure Manager");
    expect(text).not.toContain("·");
    expect(text).toMatch(/^Codebase Quality & Structure/);
  });
  it("caps long plates", () => {
    expect(plateText("Platform & Release Engineer", "Platform Engineer")).toHaveLength(32);
  });
});

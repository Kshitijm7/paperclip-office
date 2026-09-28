import { describe, expect, it } from "vitest";
import { fuzzyFilterAgents, fuzzyMatch } from "../src/ui/fuzzyMatch.js";

describe("fuzzyMatch", () => {
  it("matches a subsequence, case-insensitive", () => {
    expect(fuzzyMatch("jsm", "Jim Smith")).toBe(true);
    expect(fuzzyMatch("mij", "Jim Smith")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(fuzzyMatch("", "anything")).toBe(true);
  });
});

describe("fuzzyFilterAgents", () => {
  const candidates = [
    { id: "1", label: "Jim Halpert", haystack: "jim halpert sales rep SHO-1 fix the printer" },
    { id: "2", label: "Pam Beesly", haystack: "pam beesly office admin" },
  ];

  it("filters and ranks shorter haystacks first", () => {
    const results = fuzzyFilterAgents("pam", candidates);
    expect(results.map((r) => r.id)).toEqual(["2"]);
  });

  it("returns nothing for an empty query", () => {
    expect(fuzzyFilterAgents("  ", candidates)).toEqual([]);
  });

  it("matches an agent by issue text", () => {
    expect(fuzzyFilterAgents("printer", candidates).map((r) => r.id)).toEqual(["1"]);
  });
});

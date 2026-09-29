import { describe, expect, it } from "vitest";
import { ago, snippet } from "../src/ui/AgentMonitor.js";

describe("ago", () => {
  it("returns empty string for null", () => {
    expect(ago(null)).toBe("");
  });
  it("formats sub-minute as just now", () => {
    expect(ago(new Date().toISOString())).toBe("just now");
  });
  it("formats minutes", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(ago(iso)).toBe("5m");
  });
  it("formats hours and minutes", () => {
    const iso = new Date(Date.now() - (2 * 60 + 15) * 60_000).toISOString();
    expect(ago(iso)).toBe("2h 15m");
  });
});

describe("snippet", () => {
  it("returns empty string for null", () => {
    expect(snippet(null, 10)).toBe("");
  });
  it("collapses whitespace", () => {
    expect(snippet("a\n\nb   c", 20)).toBe("a b c");
  });
  it("truncates with ellipsis when over limit", () => {
    expect(snippet("abcdefghij", 5)).toBe("abcde…");
  });
  it("leaves short text untouched", () => {
    expect(snippet("abc", 5)).toBe("abc");
  });
});

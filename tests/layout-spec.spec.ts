import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, normalizeLayoutSpec, SPEC_LIMITS } from "../src/layout/spec.js";
import { LAYOUT_PRESETS, presetSpec } from "../src/layout/presets.js";
import { applyAgentLayout, buildLayoutBrief, parseChoice, resolveLayout, topOfOrg, type AgentLayout } from "../src/shared/layout.js";
import { DEFAULTS } from "../src/shared/settings.js";
import type { AgentRow } from "../src/shared/office.js";

describe("normalizeLayoutSpec", () => {
  it("returns the defaults for junk and never throws", () => {
    for (const raw of [undefined, null, 42, "x", [], { podSize: "big", aspect: "wide" }]) expect(normalizeLayoutSpec(raw)).toEqual(DEFAULT_SPEC);
  });

  it("clamps numbers into range and rounds integers", () => {
    const s = normalizeLayoutSpec({ maxRows: 99, corridor: 0, spineWidth: 6.6, aspect: 10, maxColumns: -3 });
    expect(s.maxRows).toBe(SPEC_LIMITS.maxRows.max);
    expect(s.corridor).toBe(SPEC_LIMITS.corridor.min);
    expect(s.spineWidth).toBe(7);
    expect(s.aspect).toBe(SPEC_LIMITS.aspect.max);
    expect(s.maxColumns).toBe(SPEC_LIMITS.maxColumns.min);
  });

  it("accepts numeric strings and only allowed enums", () => {
    const s = normalizeLayoutSpec({ podSize: "2", corridor: "3", deptOrder: "size", lounge: "yes" });
    expect(s).toMatchObject({ podSize: 2, corridor: 3, deptOrder: "size", lounge: true });
    expect(normalizeLayoutSpec({ podSize: 3 }).podSize).toBe(4);
  });

  it("repairs topBand to a full permutation", () => {
    expect(normalizeLayoutSpec({ topBand: ["break", "break", "sauna", "ceo"] }).topBand).toEqual(["break", "ceo", "boardroom", "departments"]);
  });

  it("is idempotent and JSON round-trips", () => {
    for (const p of LAYOUT_PRESETS) {
      expect(normalizeLayoutSpec(p.spec)).toEqual(p.spec);
      expect(normalizeLayoutSpec(JSON.parse(JSON.stringify(p.spec)))).toEqual(p.spec);
    }
  });
});

describe("presets", () => {
  it("have unique ids, the default first, and distinct specs", () => {
    expect(new Set(LAYOUT_PRESETS.map((p) => p.id)).size).toBe(LAYOUT_PRESETS.length);
    expect(LAYOUT_PRESETS[0].spec).toEqual(DEFAULT_SPEC);
    expect(new Set(LAYOUT_PRESETS.map((p) => JSON.stringify(p.spec))).size).toBe(LAYOUT_PRESETS.length);
    expect(presetSpec("nope")).toEqual(DEFAULT_SPEC);
  });
});

const agent: AgentLayout = { spec: presetSpec("compact"), rationale: "r", agentId: "a1", agentName: "Ann", at: "2026-09-28T00:00:00.000Z" };

describe("resolveLayout", () => {
  it("uses the settings default when nothing is saved", () => {
    expect(resolveLayout({ ...DEFAULTS, layoutPreset: "campus" }, null, null)).toMatchObject({ theme: DEFAULTS.theme, preset: "campus", spec: presetSpec("campus") });
  });

  it("lets a saved choice override the default", () => {
    expect(resolveLayout(DEFAULTS, { theme: "office", preset: "open-plan" }, null)).toMatchObject({ theme: "office", preset: "open-plan" });
    expect(resolveLayout(DEFAULTS, { theme: "generated", preset: "agent" }, agent).spec).toEqual(agent.spec);
  });

  it("falls back when the saved preset is unknown or the agent design is gone or disabled", () => {
    expect(resolveLayout(DEFAULTS, { theme: "generated", preset: "agent" }, null).preset).toBe(DEFAULTS.layoutPreset);
    expect(resolveLayout({ ...DEFAULTS, agentLayouts: false }, { theme: "generated", preset: "agent" }, agent).preset).toBe(DEFAULTS.layoutPreset);
    expect(resolveLayout(DEFAULTS, { theme: "generated", preset: "gone" }, null).preset).toBe(DEFAULTS.layoutPreset);
  });

  it("rejects malformed saved choices", () => {
    expect(parseChoice({ theme: "castle", preset: "x" })).toBeNull();
    expect(parseChoice(null)).toBeNull();
  });
});

const rows: AgentRow[] = [
  { id: "c", name: "Chief", role: "ceo", title: "CEO", reportsTo: null, status: "active" },
  { id: "l1", name: "Lea", role: "engineer", title: "Engineering", reportsTo: "c", status: "active" },
  { id: "e1", name: "Eve", role: "engineer", title: null, reportsTo: "l1", status: "active" },
];

describe("agent layout request and tool", () => {
  it("picks the top of the org chart", () => {
    expect(topOfOrg(rows)?.id).toBe("c");
  });

  it("briefs departments, headcounts, chain of command, schema and the tool", () => {
    const { title, description } = buildLayoutBrief(rows, DEFAULT_SPEC);
    expect(title).toMatch(/floor plan/);
    expect(description).toContain("Engineering: 2 agents");
    expect(description).toContain("Lea (Engineering) manages Eve");
    expect(description).toContain('"podSize"');
    expect(description).toContain("office_set_layout");
  });

  it("normalizes the spec and requires a rationale", () => {
    const now = new Date("2026-09-28T10:00:00Z");
    const ok = applyAgentLayout({ spec: { corridor: 99 }, rationale: " Teams by size. " }, "a1", "Ann", now);
    expect(ok).toEqual({ ok: true, record: { spec: normalizeLayoutSpec({ corridor: 99 }), rationale: "Teams by size.", agentId: "a1", agentName: "Ann", at: now.toISOString() } });
    expect(applyAgentLayout({ spec: '{"podSize":2}', rationale: "x" }, "a1", null, now)).toMatchObject({ ok: true, record: { spec: { podSize: 2 } } });
    expect(applyAgentLayout({ spec: { podSize: 2 } }, "a1", null, now).ok).toBe(false);
    expect(applyAgentLayout({ rationale: "x" }, "a1", null, now).ok).toBe(false);
    expect(applyAgentLayout(null, "a1", null, now).ok).toBe(false);
  });
});

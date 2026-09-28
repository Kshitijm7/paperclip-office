import { normalizeLayoutSpec, LAYOUT_SPEC_SCHEMA, type LayoutSpec } from "../layout/spec.js";
import { LAYOUT_PRESETS, presetSpec } from "../layout/presets.js";
import { buildDepartments } from "./org.js";
import type { AgentRow } from "./office.js";
import type { OfficeSettings, OfficeTheme } from "./settings.js";

export const AGENT_PRESET = "agent";
export const LAYOUT_STATE_KEYS = { choice: "layout-choice", agent: "agent-layout", request: "layout-request" } as const;
export const SET_LAYOUT_ACTION = "setLayout";
export const REQUEST_LAYOUT_ACTION = "requestAgentLayout";
export const SET_LAYOUT_TOOL = "office_set_layout";
const THEMES: OfficeTheme[] = ["office", "brooklyn99", "generated"];
const RATIONALE_MAX = 1200;

/** What the viewer picked: an upstream theme, or the generated floor with a preset (or the agent's design). */
export interface LayoutChoice { theme: OfficeTheme; preset: string }
export interface AgentLayout { spec: LayoutSpec; rationale: string; agentId: string; agentName: string | null; at: string }
export interface LayoutRequest { issueId: string; identifier: string | null; status: string | null }

export interface EffectiveLayout extends LayoutChoice {
  spec: LayoutSpec;
  presets: { id: string; label: string }[];
  agent: AgentLayout | null;
  request: LayoutRequest | null;
}

export function parseChoice(raw: unknown): LayoutChoice | null {
  const r = raw as Partial<LayoutChoice> | null;
  if (!r || typeof r !== "object" || !THEMES.includes(r.theme as OfficeTheme)) return null;
  const preset = typeof r.preset === "string" ? r.preset : "";
  return { theme: r.theme as OfficeTheme, preset };
}

export function parseAgentLayout(raw: unknown): AgentLayout | null {
  const r = raw as Partial<AgentLayout> | null;
  if (!r || typeof r !== "object" || !r.spec || typeof r.agentId !== "string") return null;
  return {
    spec: normalizeLayoutSpec(r.spec),
    rationale: String(r.rationale ?? ""),
    agentId: r.agentId,
    agentName: typeof r.agentName === "string" ? r.agentName : null,
    at: String(r.at ?? ""),
  };
}

/** Saved choice beats the settings default; an unknown preset or a missing agent design falls back to the default. */
export function resolveLayout(settings: OfficeSettings, saved: LayoutChoice | null, agent: AgentLayout | null): LayoutChoice & { spec: LayoutSpec } {
  const choice = saved ?? { theme: settings.theme, preset: settings.layoutPreset };
  const valid = (p: string) => (p === AGENT_PRESET ? !!agent && settings.agentLayouts : LAYOUT_PRESETS.some((x) => x.id === p));
  const preset = valid(choice.preset) ? choice.preset : settings.layoutPreset;
  return { theme: choice.theme, preset, spec: preset === AGENT_PRESET && agent ? agent.spec : presetSpec(preset) };
}

/** The agent at the top of the org chart, used when no designer is configured. */
export function topOfOrg(agents: AgentRow[]): AgentRow | null {
  const active = agents.filter((a) => a.status !== "terminated");
  return active.find((a) => !a.reportsTo) ?? active[0] ?? null;
}

/** Issue title and body asking an agent to design the floor. */
export function buildLayoutBrief(agents: AgentRow[], current: LayoutSpec): { title: string; description: string } {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const label = (id: string) => {
    const a = byId.get(id);
    return a ? `${a.name}${a.title ? ` (${a.title})` : ""}` : id;
  };
  const depts = buildDepartments(agents);
  const deptLines = depts.map((d) => `- ${d.name}: ${d.agentIds.length} agent${d.agentIds.length === 1 ? "" : "s"}, led by ${label(d.agentIds[0])}`);
  const chain = agents
    .filter((m) => agents.some((a) => a.reportsTo === m.id))
    .map((m) => `- ${label(m.id)} manages ${agents.filter((a) => a.reportsTo === m.id).map((a) => a.name).join(", ")}`);
  const description = [
    "Please design the floor plan for our office view. The office plugin draws one room per department, a top band with the Chief's office, the boardroom and the cafe, and a central walkway.",
    "",
    `## Departments (${agents.length} agents in total)`,
    ...deptLines,
    "",
    "## Chain of command",
    ...(chain.length ? chain : ["- Flat: nobody has direct reports."]),
    "",
    "## Layout spec",
    "Every field is optional; missing or out-of-range values are clamped to the allowed range. The schema:",
    "```json",
    JSON.stringify(LAYOUT_SPEC_SCHEMA, null, 2),
    "```",
    "The current layout, for reference:",
    "```json",
    JSON.stringify(current, null, 2),
    "```",
    "",
    "## What to do",
    `Call the tool \`${SET_LAYOUT_TOOL}\` once with \`spec\` (an object matching the schema) and \`rationale\` (one paragraph on why this layout fits how the company works, e.g. which teams sit together and why). The tool replies with the spec as it was saved. Then mark this issue done.`,
  ].join("\n");
  return { title: "Design the office floor plan", description };
}

export type ApplyLayoutResult = { ok: true; record: AgentLayout } | { ok: false; error: string };

/** Pure part of office_set_layout: validate tool params into the record we store. */
export function applyAgentLayout(params: unknown, agentId: string, agentName: string | null, now: Date): ApplyLayoutResult {
  const p = (params && typeof params === "object" ? params : {}) as { spec?: unknown; rationale?: unknown };
  const specRaw = typeof p.spec === "string" ? safeJson(p.spec) : p.spec;
  if (!specRaw || typeof specRaw !== "object") return { ok: false, error: "Pass `spec` as an object matching the layout schema." };
  const rationale = typeof p.rationale === "string" ? p.rationale.trim().slice(0, RATIONALE_MAX) : "";
  if (!rationale) return { ok: false, error: "Pass `rationale`: one paragraph on why this layout fits the company." };
  return { ok: true, record: { spec: normalizeLayoutSpec(specRaw), rationale, agentId, agentName, at: now.toISOString() } };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

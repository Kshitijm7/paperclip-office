import type { PluginContext, ToolResult } from "@paperclipai/plugin-sdk";
import { LAYOUT_PRESETS } from "../layout/presets.js";
import { LAYOUT_SPEC_SCHEMA } from "../layout/spec.js";
import {
  AGENT_PRESET,
  LAYOUT_STATE_KEYS,
  REQUEST_LAYOUT_ACTION,
  SET_LAYOUT_ACTION,
  SET_LAYOUT_TOOL,
  applyAgentLayout,
  buildLayoutBrief,
  parseAgentLayout,
  parseChoice,
  resolveLayout,
  topOfOrg,
  type EffectiveLayout,
  type LayoutRequest,
} from "../shared/layout.js";
import type { AgentRow } from "../shared/office.js";
import type { OfficeSettings } from "../shared/settings.js";

const CLOSED = new Set(["done", "cancelled"]);
const key = (companyId: string, stateKey: string) => ({ scopeKind: "company" as const, scopeId: companyId, stateKey });

type SettingsLoader = (companyId: string) => Promise<OfficeSettings>;
type AgentsLoader = (companyId: string) => Promise<AgentRow[]>;

async function readRequest(ctx: PluginContext, companyId: string): Promise<LayoutRequest | null> {
  const raw = (await ctx.state.get(key(companyId, LAYOUT_STATE_KEYS.request))) as LayoutRequest | null;
  if (!raw?.issueId) return null;
  const issue = await ctx.issues.get(raw.issueId, companyId).catch(() => null);
  return { issueId: raw.issueId, identifier: issue?.identifier ?? raw.identifier ?? null, status: issue?.status ?? null };
}

export async function loadLayout(ctx: PluginContext, companyId: string, settings: OfficeSettings): Promise<EffectiveLayout> {
  const [choiceRaw, agentRaw, request] = await Promise.all([
    ctx.state.get(key(companyId, LAYOUT_STATE_KEYS.choice)),
    ctx.state.get(key(companyId, LAYOUT_STATE_KEYS.agent)),
    settings.agentLayouts ? readRequest(ctx, companyId) : Promise.resolve(null),
  ]);
  const agent = settings.agentLayouts ? parseAgentLayout(agentRaw) : null;
  return {
    ...resolveLayout(settings, parseChoice(choiceRaw), agent),
    presets: LAYOUT_PRESETS.map(({ id, label }) => ({ id, label })),
    agent,
    request,
  };
}

export function registerLayout(ctx: PluginContext, loadSettings: SettingsLoader, loadAgents: AgentsLoader): void {
  ctx.actions.register(SET_LAYOUT_ACTION, async (params) => {
    const companyId = String(params.companyId ?? "");
    const choice = parseChoice(params);
    if (!companyId || !choice) throw new Error("companyId, theme and preset are required");
    await ctx.state.set(key(companyId, LAYOUT_STATE_KEYS.choice), choice);
    return loadLayout(ctx, companyId, await loadSettings(companyId));
  });

  ctx.actions.register(REQUEST_LAYOUT_ACTION, async (params) => {
    const companyId = String(params.companyId ?? "");
    if (!companyId) throw new Error("companyId is required");
    const settings = await loadSettings(companyId);
    if (!settings.agentLayouts) return { ok: false, message: "Agent-designed layouts are turned off in the plugin settings." };
    const open = await readRequest(ctx, companyId);
    if (open && !CLOSED.has(open.status ?? "")) return { ok: false, message: `A layout request is already open (${open.identifier ?? open.issueId}).`, request: open };

    const agents = await loadAgents(companyId);
    const designer = agents.find((a) => a.id === settings.layoutDesignerAgentId) ?? topOfOrg(agents);
    if (!designer) return { ok: false, message: "No agent to ask: the company has no agents." };
    const current = await loadLayout(ctx, companyId, settings);
    const brief = buildLayoutBrief(agents, current.spec);
    const issue = await ctx.issues.create({ companyId, title: brief.title, description: brief.description, assigneeAgentId: designer.id, status: "todo" });
    const request: LayoutRequest = { issueId: issue.id, identifier: issue.identifier ?? null, status: issue.status };
    await ctx.state.set(key(companyId, LAYOUT_STATE_KEYS.request), request);
    return { ok: true, message: `Asked ${designer.name} to design the floor.`, request };
  });

  ctx.tools.register(
    SET_LAYOUT_TOOL,
    {
      displayName: "Set office layout",
      description: "Save a floor plan for the office view: a layout spec plus a one-paragraph rationale. Returns the spec as saved.",
      parametersSchema: {
        type: "object",
        properties: { spec: LAYOUT_SPEC_SCHEMA, rationale: { type: "string" } },
        required: ["spec", "rationale"],
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const settings = await loadSettings(runCtx.companyId);
      if (!settings.agentLayouts) return { content: "Agent-designed layouts are turned off for this company, so nothing was saved." };
      const agents = await loadAgents(runCtx.companyId);
      const name = agents.find((a) => a.id === runCtx.agentId)?.name ?? null;
      const result = applyAgentLayout(params, runCtx.agentId, name, new Date());
      if (!result.ok) return { content: result.error, error: result.error };
      await ctx.state.set(key(runCtx.companyId, LAYOUT_STATE_KEYS.agent), result.record);
      return {
        content: `Saved. The office now offers your layout as "Agent-designed" (select it with preset "${AGENT_PRESET}"). Normalized spec: ${JSON.stringify(result.record.spec)}`,
        data: result.record.spec,
      };
    },
  );
}

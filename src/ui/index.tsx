import { useEffect, useMemo, useRef, useState } from "react";
import type { Prefs } from "../shared/prefs.js";
import {
  useHostNavigation,
  usePluginData,
  type PluginPageProps,
  type PluginSidebarProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { PAGE_ROUTE, type OfficeAgent, type OfficeData, type OfficeState } from "../shared/office.js";
import { formatSpend, type CostMetric } from "../shared/cost.js";
import { ActivityFeed } from "./ActivityFeed.js";
import { AgentMonitor } from "./AgentMonitor.js";
import { AgentSearch } from "./AgentSearch.js";
import { DecisionBox } from "./DecisionBox.js";
import { DECISIONS_DATA_KEY, type DecisionItem } from "../shared/decisions.js";
import { OfficeScene } from "./OfficeScene.js";
import { ROSTER_WIDTH, RosterSidebar } from "./RosterSidebar.js";
import { SceneControls } from "./SceneControls.js";
import { OrgPanel } from "./OrgPanel.js";
import { Collapsible } from "./Collapsible.js";
import { WallOfFame } from "./WallOfFame.js";
import { tokens } from "./tokens.js";
import { useOffice } from "./useOffice.js";
import { STATE_COLOR } from "./stateColors.js";
import { useStore } from "../adapters/store.js";
import { presetSpec } from "../layout/presets.js";
import { AGENT_PRESET, type EffectiveLayout, type LayoutChoice } from "../shared/layout.js";

const STATES: OfficeState[] = ["working", "thinking", "blocked", "idle"];

function ago(iso: string | null): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color, flex: "none" }} />;
}

function Counts({ agents }: { agents: OfficeAgent[] }) {
  const stuck = agents.filter((a) => a.stuck).length;
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
      {STATES.map((s) => (
        <span key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Dot color={STATE_COLOR[s]} />
          {agents.filter((a) => a.state === s).length} {s}
        </span>
      ))}
      {stuck > 0 && (
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: STATE_COLOR.stuck, fontWeight: 600 }}>
          <Dot color={STATE_COLOR.stuck} />
          {stuck} stuck
        </span>
      )}
    </div>
  );
}

function Bottlenecks({ agents, count }: { agents: OfficeAgent[]; count: number }) {
  const top = [...agents]
    .filter((a) => a.queueDepth > 0)
    .sort((a, b) => b.queueDepth - a.queueDepth || (b.oldestWaitMinutes ?? 0) - (a.oldestWaitMinutes ?? 0))
    .slice(0, count);
  if (top.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
      <span style={{ color: tokens.mutedForeground }}>Bottlenecks</span>
      {top.map((a) => (
        <button
          key={a.id}
          onClick={() => useStore.setState({ selectedId: a.id })}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 12, border: `1px solid ${tokens.border}`, background: tokens.surface, color: "inherit", cursor: "pointer", font: "inherit", fontSize: 12 }}
        >
          {a.name}
          <span style={{ color: tokens.mutedForeground }}>{a.queueDepth}</span>
        </button>
      ))}
    </div>
  );
}

function StateBoard({ agents, cost }: { agents: OfficeAgent[]; cost: CostMetric | null }) {
  const nav = useHostNavigation();
  const cell = { padding: "7px 10px", borderBottom: `1px solid ${tokens.border}`, textAlign: "left" as const };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ color: tokens.mutedForeground }}>
        <tr>
          <th style={cell}>Agent</th>
          <th style={cell}>State</th>
          <th style={cell}>Issue</th>
          <th style={cell}>For</th>
          <th style={cell}>Latest output</th>
          {cost && <th style={cell}>Cost</th>}
        </tr>
      </thead>
      <tbody>
        {agents.map((a) => (
          <tr
            key={a.id}
            onClick={() => useStore.setState({ selectedId: a.id })}
            style={{
              cursor: "pointer",
              ...(a.stuck
                ? { background: "color-mix(in oklch, var(--destructive) 10%, transparent)" }
                : a.overBudget
                  ? { background: "color-mix(in oklch, oklch(72% 0.15 75) 10%, transparent)" }
                  : undefined),
            }}
          >
            <td style={cell}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: 10, padding: "0 5px", borderRadius: 8, background: tokens.accent, color: tokens.mutedForeground }}>
                  {a.levelName}
                </span>
              </div>
              <div style={{ color: tokens.mutedForeground, fontSize: 12 }}>{a.title ?? a.role}</div>
            </td>
            <td style={cell}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Dot color={a.stuck ? STATE_COLOR.stuck : STATE_COLOR[a.state]} />
                {a.stuck ? `stuck: ${a.stuckReason}` : a.state}
              </span>
            </td>
            <td style={cell}>
              {a.issue ? (
                <>
                  <a {...nav.linkProps(`/issues/${a.issue.label}`)} style={{ color: "inherit" }}>
                    {a.issue.label} <span style={{ color: tokens.mutedForeground }}>{a.issue.title}</span>
                  </a>
                  {a.progress !== null && (
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: tokens.border, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(a.progress * 100)}%`, height: "100%", background: tokens.primary }} />
                    </div>
                  )}
                </>
              ) : (
                <span style={{ color: tokens.mutedForeground }}>none</span>
              )}
            </td>
            <td style={{ ...cell, whiteSpace: "nowrap" }}>{ago(a.since)}</td>
            <td style={{ ...cell, color: tokens.mutedForeground, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
              {a.thought ?? ""}
            </td>
            {cost && (
              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                {formatSpend(a.costTodayCents, a.tokensToday, cost)} <span style={{ color: tokens.mutedForeground }}>today</span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div style={{ width: 60, height: 5, borderRadius: 3, background: tokens.border, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: tokens.primary }} />
    </div>
  );
}

function Scoreboard({ agents }: { agents: OfficeAgent[] }) {
  const [sortBy, setSortBy] = useState<"productivity" | "efficiency">("productivity");
  const rows = [...agents]
    .filter((a) => a.scores)
    .sort((a, b) => {
      if (!!a.scores!.flag !== !!b.scores!.flag) return a.scores!.flag ? -1 : 1;
      return b.scores![sortBy] - a.scores![sortBy] || a.id.localeCompare(b.id);
    });
  if (rows.length === 0) return null;
  const cell = { padding: "7px 10px", borderBottom: `1px solid ${tokens.border}`, textAlign: "left" as const };
  const headBtn = (key: "productivity" | "efficiency", label: string) => (
    <th style={cell}>
      <button onClick={() => setSortBy(key)} style={{ background: "none", border: "none", color: sortBy === key ? "inherit" : tokens.mutedForeground, cursor: "pointer", font: "inherit", padding: 0 }}>
        {label}
      </button>
    </th>
  );
  const flagged = rows.filter((a) => a.scores!.flag).length;
  return (
    <Collapsible id="scoreboard" title="Scoreboard" hint={`${rows.length} agents${flagged ? `, ${flagged} flagged` : ""}`}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ color: tokens.mutedForeground }}>
          <tr>
            <th style={cell}>Agent</th>
            <th style={cell}>Role</th>
            {headBtn("productivity", "Productivity")}
            {headBtn("efficiency", "Efficiency")}
            <th style={cell}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.id}
              onClick={() => useStore.setState({ selectedId: a.id })}
              style={{ cursor: "pointer", ...(a.scores!.flag ? { background: "color-mix(in oklch, var(--destructive) 10%, transparent)" } : undefined) }}
            >
              <td style={cell}>{a.name}</td>
              <td style={{ ...cell, color: tokens.mutedForeground }}>{a.title ?? a.role}</td>
              <td style={cell}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Bar value={a.scores!.productivity} />{a.scores!.productivity}</div></td>
              <td style={cell}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Bar value={a.scores!.efficiency} />{a.scores!.efficiency}</div></td>
              <td style={{ ...cell, color: tokens.mutedForeground }}>{a.scores!.flag ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Collapsible>
  );
}

function BudgetBanner({ data }: { data: OfficeData }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || data.budgetIncidents.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: tokens.radius,
        border: `1px solid ${tokens.destructive}`,
        background: "color-mix(in oklch, var(--destructive) 10%, transparent)",
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1 }}>
        {data.budgetIncidents.length} open budget {data.budgetIncidents.length === 1 ? "incident" : "incidents"}:{" "}
        {data.budgetIncidents.map((i) => data.agents.find((a) => a.id === i.scopeId)?.name ?? `${i.scopeType} budget`).join(", ")}
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, cursor: "pointer", padding: "2px 8px" }}
      >
        Dismiss
      </button>
    </div>
  );
}

function DecisionsButton({ count }: { count: number }) {
  return (
    <button
      onClick={() => useStore.setState({ decisionBoxOpen: true })}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999,
        border: `1px solid ${count > 0 ? tokens.destructive : tokens.border}`,
        background: count > 0 ? "color-mix(in oklch, var(--destructive) 10%, transparent)" : "transparent",
        color: "inherit", cursor: "pointer", font: "inherit", fontSize: 13,
      }}
      aria-label={`Decisions (${count})`}
    >
      Decisions ({count})
    </button>
  );
}

export function OfficePage({ context }: PluginPageProps) {
  const companyId = context.companyId ?? "";
  const { data: served, error } = useOffice(companyId);
  const [prefs, setPrefs] = useState<Prefs>({});
  const data = useMemo(() => (served ? { ...served, settings: { ...served.settings, ...prefs } } : served), [served, prefs]);
  const changePrefs = (patch: Prefs) => setPrefs((p) => ({ ...p, ...patch }));
  const { data: decisions, refresh: refreshDecisions } = usePluginData<{ items: DecisionItem[] }>(DECISIONS_DATA_KEY, { companyId });
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const pendingDecisions = (decisions?.items ?? []).filter((i) => !decided.has(i.id));
  const decisionCount = pendingDecisions.length;
  const onDecided = (id: string) => {
    setDecided((prev) => new Set(prev).add(id));
    void refreshDecisions();
  };
  const decisionBoxOn = data?.settings.decisionBox ?? true;
  const sceneRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const rosterOpen = useStore((s) => s.rosterOpen) && (data?.settings.rosterSidebar ?? true);
  const [picked, setPicked] = useState<LayoutChoice | null>(null);
  const saved = data?.layout;
  useEffect(() => {
    if (picked && saved && saved.theme === picked.theme && saved.preset === picked.preset) setPicked(null);
  }, [picked, saved]);
  const layout: EffectiveLayout | undefined = saved && picked
    ? { ...saved, ...picked, spec: picked.preset === AGENT_PRESET && saved.agent ? saved.agent.spec : presetSpec(picked.preset) }
    : saved;
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16, color: tokens.foreground }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Office</h1>
          {decisionBoxOn && <DecisionsButton count={decisionCount} />}
          {data && <Counts agents={data.agents} />}
          {data && (data.settings.heatmap ?? true) && <Bottlenecks agents={data.agents} count={data.settings.bottleneckCount ?? 5} />}
        </div>
      </div>
      {error && <div style={{ color: tokens.destructive }}>{error.message}</div>}
      {data && (data.settings.budgetAlerts ?? true) && <BudgetBanner data={data} />}
      <div
        ref={sceneRef}
        style={{
          height: full ? "100vh" : "min(68vh, 720px)",
          borderRadius: full ? 0 : tokens.radius,
          border: full ? "none" : `1px solid ${tokens.border}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, left: rosterOpen ? ROSTER_WIDTH : 0 }}>
          <OfficeScene companyId={companyId} data={data ?? undefined} layout={layout} />
        </div>
        {(data?.settings.rosterSidebar ?? true) && <RosterSidebar data={data ?? null} bubblesOn={data?.settings.bubbles !== "none"} onToggleBubbles={() => changePrefs({ bubbles: data?.settings.bubbles === "none" ? "activity" : "none" })} />}
        <WallOfFame companyId={companyId} office={data ?? null} />
        {/* Inside the fullscreen element, or the browser hides it in fullscreen. */}
        <AgentMonitor companyId={companyId} />
        {decisionBoxOn && <DecisionBox companyId={companyId} items={pendingDecisions} onDecided={onDecided} />}
        {(data?.settings.search ?? true) && <AgentSearch data={data ?? null} />}
        <SceneControls
          sceneRef={sceneRef}
          search={data?.settings.search ?? true}
          layout={layout && (data?.settings.layoutPicker ?? true) ? { companyId, layout, agentLayouts: data?.settings.agentLayouts ?? true, onPick: setPicked } : null}
          decisionCount={decisionBoxOn ? decisionCount : undefined}
          prefs={data ? { companyId, settings: data.settings, onChange: changePrefs } : null}
        />
      </div>
      {data && (data.settings.activityFeed ?? true) && (
        <ActivityFeed companyId={companyId} windowHours={data.settings.activityWindowHours} limit={data.settings.activityLimit} />
      )}
      {data && (data.settings.scoreboard ?? true) && <Scoreboard agents={data.agents} />}
      {data && (data.settings.showOrgPanel ?? true) && (
        <Collapsible id="org" title="Chain of command" hint={`${data.agents.length} agents`}>
          <OrgPanel data={data} />
        </Collapsible>
      )}
      {data && (data.settings.showStateBoard ?? true) && (
        <Collapsible id="states" title="Agent states" hint="state, current issue, time and spend">
          <StateBoard agents={data.agents} cost={(data.settings.showCost ?? true) ? data.settings.costMetric ?? "auto" : null} />
        </Collapsible>
      )}
    </div>
  );
}

export function SidebarLink(_props: PluginSidebarProps) {
  const nav = useHostNavigation();
  return (
    <a
      {...nav.linkProps(`/${PAGE_ROUTE}`)}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", color: "inherit", textDecoration: "none" }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1.5" y="6" width="11" height="3" rx="0.5" />
        <path d="M3 9v3.5M11 9v3.5M5 6V3.5h4V6" />
      </svg>
      Office
    </a>
  );
}

const WIDGET_ROWS = 6;

export function OfficeWidget({ context }: PluginWidgetProps) {
  const nav = useHostNavigation();
  const { data } = useOffice(context.companyId ?? "");
  const stuck = data?.agents.filter((a) => a.stuck) ?? [];
  const active = data?.agents.filter((a) => a.state !== "idle" && !a.stuck) ?? [];
  const { data: decisions } = usePluginData<{ items: DecisionItem[] }>(DECISIONS_DATA_KEY, { companyId: context.companyId ?? "" });
  const pending = decisions?.items.length ?? 0;
  return (
    // The dashboard slot gets a null companyPrefix and resolves bare paths without it; the page URL still starts with it.
    <a {...nav.linkProps(`/${context.companyPrefix ?? window.location.pathname.split("/")[1]}/${PAGE_ROUTE}`)} style={{ display: "flex", flexDirection: "column", gap: 10, color: "inherit", textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
        Office
        {stuck.length > 0 && <Dot color={STATE_COLOR.stuck} />}
      </div>
      {data ? <Counts agents={data.agents} /> : <span style={{ color: tokens.mutedForeground }}>Loading</span>}
      {pending > 0 && (
        <div style={{ fontSize: 13, color: tokens.destructive, fontWeight: 600 }}>
          {pending} decision{pending === 1 ? "" : "s"} waiting on you
        </div>
      )}
      {stuck.slice(0, 3).map((a) => (
        <div key={a.id} style={{ fontSize: 12, color: STATE_COLOR.stuck }}>
          {a.name}: {a.stuckReason}
        </div>
      ))}
      {active.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: `1px solid ${tokens.border}`, paddingTop: 8 }}>
          {active.slice(0, WIDGET_ROWS).map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, minWidth: 0 }}>
              <Dot color={STATE_COLOR[a.state]} />
              <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{a.name}</span>
              <span style={{ color: tokens.mutedForeground, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.issue ? `${a.issue.label} · ${a.issue.title}` : a.state}
              </span>
            </div>
          ))}
          {active.length > WIDGET_ROWS && <span style={{ fontSize: 12, color: tokens.mutedForeground }}>+{active.length - WIDGET_ROWS} more</span>}
        </div>
      )}
    </a>
  );
}

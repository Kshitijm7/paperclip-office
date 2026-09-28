import { useEffect, useRef, useState } from "react";
import {
  useHostNavigation,
  type PluginPageProps,
  type PluginSidebarProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import { PAGE_ROUTE, type OfficeAgent, type OfficeState } from "../shared/office.js";
import { AgentMonitor } from "./AgentMonitor.js";
import { AgentSearch, SEARCH_OPEN_EVENT } from "./AgentSearch.js";
import { OfficeScene } from "./OfficeScene.js";
import { SceneControls } from "./SceneControls.js";
import { OrgPanel } from "./OrgPanel.js";
import { WallOfFame } from "./WallOfFame.js";
import { tokens } from "./tokens.js";
import { useOffice } from "./useOffice.js";
import { STATE_COLOR } from "./stateColors.js";
import { useStore } from "../adapters/store.js";

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

function StateBoard({ agents }: { agents: OfficeAgent[] }) {
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
        </tr>
      </thead>
      <tbody>
        {agents.map((a) => (
          <tr
            key={a.id}
            onClick={() => useStore.setState({ selectedId: a.id })}
            style={{
              cursor: "pointer",
              ...(a.stuck ? { background: "color-mix(in oklch, var(--destructive) 10%, transparent)" } : undefined),
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function OfficePage({ context }: PluginPageProps) {
  const companyId = context.companyId ?? "";
  const { data, error } = useOffice(companyId);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
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
          {data && <Counts agents={data.agents} />}
          {data && (data.settings.heatmap ?? true) && <Bottlenecks agents={data.agents} count={data.settings.bottleneckCount ?? 5} />}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(data?.settings.search ?? true) && (
            <button
              onClick={() => window.dispatchEvent(new Event(SEARCH_OPEN_EVENT))}
              title="Search agents (/)"
              style={{
                padding: "6px 12px",
                borderRadius: tokens.radius,
                border: `1px solid ${tokens.border}`,
                background: tokens.surface,
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Search
            </button>
          )}
        </div>
      </div>
      {error && <div style={{ color: tokens.destructive }}>{error.message}</div>}
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
        <OfficeScene companyId={companyId} data={data ?? undefined} />
        <WallOfFame companyId={companyId} office={data ?? null} />
        {/* Inside the fullscreen element, or the browser hides it in fullscreen. */}
        <AgentMonitor companyId={companyId} />
        {(data?.settings.search ?? true) && <AgentSearch data={data ?? null} />}
        <SceneControls sceneRef={sceneRef} />
      </div>
      {(data?.settings.showOrgPanel ?? true) && <OrgPanel data={data ?? null} />}
      {data && (data.settings.showStateBoard ?? true) && (
        <div style={{ border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, background: tokens.surface }}>
          <StateBoard agents={data.agents} />
        </div>
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

export function OfficeWidget({ context }: PluginWidgetProps) {
  const nav = useHostNavigation();
  const { data } = useOffice(context.companyId ?? "");
  const stuck = data?.agents.filter((a) => a.stuck) ?? [];
  return (
    <a {...nav.linkProps(`/${PAGE_ROUTE}`)} style={{ display: "flex", flexDirection: "column", gap: 10, color: "inherit", textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
        Office
        {stuck.length > 0 && <Dot color={STATE_COLOR.stuck} />}
      </div>
      {data ? <Counts agents={data.agents} /> : <span style={{ color: tokens.mutedForeground }}>Loading</span>}
      {stuck.slice(0, 3).map((a) => (
        <div key={a.id} style={{ fontSize: 12, color: STATE_COLOR.stuck }}>
          {a.name}: {a.stuckReason}
        </div>
      ))}
    </a>
  );
}

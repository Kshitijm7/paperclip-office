import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../adapters/store.js";
import type { OfficeAgent, OfficeData } from "../shared/office.js";
import { fuzzyFilterAgents, type SearchCandidate } from "./fuzzyMatch.js";
import { STATE_COLOR } from "./stateColors.js";
import { tokens } from "./tokens.js";

export const ROSTER_WIDTH = 220;
const STORAGE_KEY = "office:rosterSidebar:open";

function readOpen(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function writeOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // best-effort; a private window or blocked storage just won't remember the toggle
  }
}

function candidatesFor(agents: OfficeAgent[]): SearchCandidate[] {
  return agents.map((a) => ({
    id: a.id,
    label: a.name,
    haystack: [a.name, a.title, a.role, a.department, a.issue?.label, a.issue?.title].filter(Boolean).join(" "),
  }));
}

function Avatar({ agentId }: { agentId: string }) {
  const character = useStore((s) => s.agents.find((a) => a.id === agentId)?.character);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!character || !canvasRef.current) return;
    let cancelled = false;
    import("../../vendor/munder-difflin/src/renderer/src/scene/office/cast.js").then(({ paintCastPortrait }) => {
      if (cancelled || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) void paintCastPortrait(ctx, character, 1.5);
    });
    return () => {
      cancelled = true;
    };
  }, [character]);
  return <canvas ref={canvasRef} width={27} height={42} style={{ width: 22, height: 34, borderRadius: 4, flex: "none", background: tokens.accent }} />;
}

function Row({ agent, onPick }: { agent: OfficeAgent; onPick: (id: string) => void }) {
  const scores = agent.scores;
  const subtitle = [agent.title, agent.role].find((x) => x && x.toLowerCase() !== agent.name.toLowerCase());
  return (
    <div
      onClick={() => onPick(agent.id)}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", borderRadius: 6 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.selected)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Avatar agentId={agent.id} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</span>
          {scores?.flag && <span title={scores.flag} style={{ color: tokens.destructive }}>⚑</span>}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: tokens.mutedForeground, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: subtitle === agent.role ? "capitalize" : undefined }}>
            {subtitle}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: tokens.mutedForeground, marginTop: 2 }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: agent.stuck ? STATE_COLOR.stuck : STATE_COLOR[agent.state] }} />
          {agent.issue ? agent.issue.label : agent.state}
          {scores && (
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono, monospace)" }}>
              P{Math.round(scores.productivity)} · E{Math.round(scores.efficiency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DeptGroup({ name, agents, onPick }: { name: string; agents: OfficeAgent[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: tokens.mutedForeground, cursor: "pointer" }}
      >
        <span style={{ transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.1s" }}>›</span>
        {name} ({agents.length})
      </div>
      {open && agents.map((a) => <Row key={a.id} agent={a} onPick={onPick} />)}
    </div>
  );
}

/** Collapsible roster: search, avatar, role, department, state + issue, scores. Lives inside the
 *  scene container (not a portal) so it survives fullscreen, same rule as AgentMonitor/DecisionBox. */
export function RosterSidebar({ data }: { data: OfficeData | null }) {
  const [open, setOpen] = useState(readOpen);
  const [query, setQuery] = useState("");
  useEffect(() => {
    writeOpen(open);
    useStore.setState({ rosterOpen: open });
    return () => useStore.setState({ rosterOpen: false });
  }, [open]);

  const agents = data?.agents ?? [];
  const filteredIds = useMemo(() => {
    if (!query.trim()) return null;
    return new Set(fuzzyFilterAgents(query, candidatesFor(agents)).map((c) => c.id));
  }, [query, agents]);

  const groups = useMemo(() => {
    const byDept = new Map<string, OfficeAgent[]>();
    for (const a of agents) {
      if (filteredIds && !filteredIds.has(a.id)) continue;
      if (!byDept.has(a.department)) byDept.set(a.department, []);
      byDept.get(a.department)!.push(a);
    }
    return [...byDept.entries()];
  }, [agents, filteredIds]);

  const pick = (id: string) => useStore.setState({ selectedId: id });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open roster"
        style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 30,
          width: 22, height: 64, borderRadius: "0 6px 6px 0", border: `1px solid ${tokens.border}`, borderLeft: "none",
          background: tokens.surface, color: tokens.foreground, cursor: "pointer", fontSize: 13,
        }}
      >
        ›
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: ROSTER_WIDTH, zIndex: 30,
        background: tokens.surface, borderRight: `1px solid ${tokens.border}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: `1px solid ${tokens.border}` }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search roster…"
          style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: tokens.radius, border: `1px solid ${tokens.border}`, background: "transparent", color: "inherit", font: "inherit", fontSize: 12, outline: "none" }}
        />
        <button
          onClick={() => setOpen(false)}
          aria-label="Collapse roster"
          style={{ background: "none", border: "none", color: tokens.mutedForeground, cursor: "pointer", fontSize: 14, padding: 2 }}
        >
          ‹
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {groups.length === 0 && <div style={{ padding: 12, fontSize: 12, color: tokens.mutedForeground }}>No matches</div>}
        {groups.map(([name, list]) => (
          <DeptGroup key={name} name={name} agents={list} onPick={pick} />
        ))}
      </div>
    </div>
  );
}

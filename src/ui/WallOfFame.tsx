import { useEffect, useState } from "react";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";
import { useStore } from "../adapters/store.js";
import type { OfficeAgent, OfficeData } from "../shared/office.js";
import type { AgentStats, RecognitionData } from "../worker/recognition.js";
import { tokens } from "./tokens.js";

const POLL_MS = 30_000;

function select(agentId: string) {
  useStore.getState().select(agentId);
}

function StatLine({ label, stat }: { label: string; stat: AgentStats | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ color: tokens.mutedForeground }}>{label}</span>
      {stat ? (
        <button onClick={() => select(stat.agentId)} style={nameButtonStyle}>
          {stat.name} <span style={{ color: tokens.mutedForeground }}>· {stat.score} pts</span>
        </button>
      ) : (
        <span style={{ color: tokens.mutedForeground }}>none yet</span>
      )}
    </div>
  );
}

const nameButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "inherit",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: tokens.mutedForeground,
  marginTop: 14,
  marginBottom: 6,
};

function levelsBySeniority(agents: OfficeAgent[]) {
  const groups = new Map<string, OfficeAgent[]>();
  for (const a of agents) {
    if (!groups.has(a.levelName)) groups.set(a.levelName, []);
    groups.get(a.levelName)!.push(a);
  }
  return [...groups.entries()].sort((a, b) => (b[1][0]?.level ?? 0) - (a[1][0]?.level ?? 0));
}

function FameDialog({ recognition, office, onClose }: { recognition: RecognitionData; office: OfficeData | null; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 100%)",
          maxHeight: "min(78vh, 640px)",
          overflowY: "auto",
          background: "linear-gradient(180deg, #3b2c1a, #241a0f)",
          border: "10px solid #6b4a26",
          borderRadius: 6,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), inset 0 0 0 2px #c9a35c",
          padding: 20,
          color: "#f4e6c8",
          transform: shown ? "scale(1)" : "scale(0.85)",
          opacity: shown ? 1 : 0,
          transition: "transform 180ms ease, opacity 180ms ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontFamily: "Georgia, serif", letterSpacing: "0.03em" }}>Wall of Fame</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#f4e6c8", fontSize: 18, cursor: "pointer" }}>
            ×
          </button>
        </div>

        <div style={sectionTitleStyle}>Employee of the Week</div>
        <StatLine label="Top score, last 7 days" stat={recognition.employeeOfWeek} />

        <div style={sectionTitleStyle}>Employee of the Month</div>
        <StatLine label="Top score, last 30 days" stat={recognition.employeeOfMonth} />

        <div style={sectionTitleStyle}>Leaderboard (30 days)</div>
        {recognition.leaderboard.length === 0 && <span style={{ color: "#f4e6c899" }}>no data yet</span>}
        {recognition.leaderboard.map((stat, i) => (
          <div key={stat.agentId} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>
              <span style={{ color: "#f4e6c899", marginRight: 6 }}>#{i + 1}</span>
              <button onClick={() => select(stat.agentId)} style={nameButtonStyle}>
                {stat.name}
              </button>
            </span>
            <span style={{ color: "#f4e6c899" }}>{stat.score} pts</span>
          </div>
        ))}

        <div style={sectionTitleStyle}>Most reliable</div>
        {recognition.mostReliable ? (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => select(recognition.mostReliable!.agentId)} style={nameButtonStyle}>
              {recognition.mostReliable.name}
            </button>
            <span style={{ color: "#f4e6c899" }}>
              {Math.round(recognition.mostReliable.successRate * 100)}% over {recognition.mostReliable.runs} runs
            </span>
          </div>
        ) : (
          <span style={{ color: "#f4e6c899" }}>not enough runs yet</span>
        )}

        <div style={sectionTitleStyle}>Department winners</div>
        {recognition.byDepartment.map((stat) => (
          <div key={stat.agentId} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span style={{ color: "#f4e6c899" }}>{stat.department}</span>
            <button onClick={() => select(stat.agentId)} style={nameButtonStyle}>
              {stat.name}
            </button>
          </div>
        ))}

        {office && (
          <>
            <div style={sectionTitleStyle}>Levels</div>
            {levelsBySeniority(office.agents).map(([levelName, group]) => (
              <div key={levelName} style={{ padding: "3px 0" }}>
                <span style={{ color: "#f4e6c899" }}>{levelName}: </span>
                {group.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    <button onClick={() => select(a.id)} style={{ ...nameButtonStyle, fontWeight: 400 }}>
                      {a.name}
                    </button>
                  </span>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Small framed plaque pinned to the scene's top-left wall; click for the full Wall of Fame dialog. */
export function WallOfFame({ companyId, office }: { companyId: string; office: OfficeData | null }) {
  const { data, refresh } = usePluginData<RecognitionData>("recognition", { companyId });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!data) return null;
  const winner = data.employeeOfWeek;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "linear-gradient(180deg, #4a371f, #2c2012)",
          border: "2px solid #c9a35c",
          borderRadius: 4,
          color: "#f4e6c8",
          fontSize: 11,
          fontFamily: "Georgia, serif",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
          maxWidth: 200,
        }}
      >
        <span aria-hidden="true">★</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {winner ? winner.name : "Wall of Fame"}
        </span>
      </button>
      {open && <FameDialog recognition={data} office={office} onClose={() => setOpen(false)} />}
    </>
  );
}

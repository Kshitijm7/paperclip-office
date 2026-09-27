import { useEffect } from "react";
import { usePluginData, useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { useStore } from "../adapters/store.js";
import type { OfficeState } from "../shared/office.js";
import type { AgentDetail } from "../worker/agent-detail.js";

const POLL_MS = 4000;

const LED_COLOR: Record<OfficeState | "stuck", string> = {
  working: "oklch(72% 0.15 75)",
  thinking: "oklch(62% 0.12 220)",
  blocked: "oklch(62% 0.17 25)",
  idle: "oklch(55% 0 0)",
  stuck: "oklch(58% 0.22 25)",
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5fdc7a", opacity: 0.7, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function IssueLine({ issue }: { issue: { id: string; identifier: string | null; title: string; status: string } }) {
  const nav = useHostNavigation();
  return (
    <a
      {...nav.linkProps(`/issues/${issue.identifier ?? issue.id}`)}
      style={{ display: "block", color: "#9df0b0", textDecoration: "none", fontSize: 13, padding: "3px 0" }}
    >
      {issue.identifier ?? issue.id.slice(0, 8)} <span style={{ color: "#5fdc7a99" }}>{issue.title}</span>
    </a>
  );
}

function MonitorBody({ companyId, agentId, onClose }: { companyId: string; agentId: string; onClose: () => void }) {
  const { data, refresh } = usePluginData<AgentDetail>("agent", { companyId, agentId });
  const nav = useHostNavigation();

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!data) {
    return <div style={{ color: "#5fdc7a", fontFamily: "var(--font-mono, monospace)", padding: 20 }}>connecting...</div>;
  }

  const { agent, office, manager, reports, openIssues, doneIssues, runs } = data;
  const led = office.stuck ? LED_COLOR.stuck : LED_COLOR[office.state];

  return (
    <div style={{ fontFamily: "var(--font-mono, monospace)", color: "#c9ffd6", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          aria-hidden="true"
          style={{ width: 10, height: 10, borderRadius: "50%", background: led, boxShadow: `0 0 8px 2px ${led}`, flex: "none" }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#eafff0", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</div>
          <div style={{ color: "#5fdc7a99", fontSize: 12 }}>{agent.title ?? agent.role ?? agent.status}</div>
        </div>
      </div>

      <Section title={office.stuck ? `Stuck: ${office.stuckReason}` : `${office.state}${office.since ? ` · ${ago(office.since)}` : ""}`}>
        {office.issue ? (
          <IssueLine issue={{ id: office.issue.id, identifier: office.issue.label, title: office.issue.title, status: office.issue.status }} />
        ) : (
          <span style={{ color: "#5fdc7a66" }}>no current issue</span>
        )}
      </Section>

      <Section title="Chain of command">
        <div style={{ color: "#5fdc7a99" }}>
          Reports to {manager ? <span style={{ color: "#c9ffd6" }}>{manager.name}</span> : "no one"}
        </div>
        {reports.length > 0 && (
          <div style={{ color: "#5fdc7a99", marginTop: 2 }}>
            Manages <span style={{ color: "#c9ffd6" }}>{reports.map((r) => r.name).join(", ")}</span>
          </div>
        )}
      </Section>

      <Section title={`Open issues (${openIssues.length})`}>
        {openIssues.length === 0 && <span style={{ color: "#5fdc7a66" }}>none</span>}
        {openIssues.map((i) => (
          <IssueLine key={i.id} issue={i} />
        ))}
      </Section>

      <Section title={`Recently done (${doneIssues.length})`}>
        {doneIssues.length === 0 && <span style={{ color: "#5fdc7a66" }}>none</span>}
        {doneIssues.map((i) => (
          <IssueLine key={i.id} issue={i} />
        ))}
      </Section>

      <Section title="Recent runs">
        {runs.length === 0 && <span style={{ color: "#5fdc7a66" }}>none</span>}
        {runs.map((r) => (
          <div key={r.runId} style={{ borderTop: "1px solid #1f4a2c", padding: "6px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#9df0b0" }}>
              <span>{r.status}{r.invocationSource ? ` · ${r.invocationSource}` : ""}</span>
              <span style={{ color: "#5fdc7a99" }}>{ago(r.startedAt)}</span>
            </div>
            {r.error && <div style={{ color: "oklch(72% 0.19 30)", fontSize: 12 }}>{r.error}</div>}
          </div>
        ))}
      </Section>

      {runs[0]?.stdoutExcerpt && (
        <Section title="Latest output">
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#02130a",
              border: "1px solid #1f4a2c",
              borderRadius: 4,
              padding: 10,
              maxHeight: 180,
              overflowY: "auto",
              fontSize: 12,
              color: "#9df0b0",
              margin: 0,
            }}
          >
            {runs[0].stdoutExcerpt}
          </pre>
        </Section>
      )}
    </div>
  );
}

/** Styled as a retro CRT monitor: bezel, scanline glow, stand, and a state-colored power LED. */
export function AgentMonitor({ companyId }: { companyId: string }) {
  const selectedId = useStore((s) => s.selectedId);
  const close = () => useStore.setState({ selectedId: null });

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  if (!selectedId) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "min(560px, 100%)", width: "100%" }}
      >
        <div
          style={{
            width: "100%",
            background: "linear-gradient(180deg, #d8d4c8, #b8b3a4)",
            borderRadius: 18,
            padding: 18,
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={close}
              aria-label="Close"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "1px solid #8a8578",
                background: "#c7c2b4",
                color: "#4a463c",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              position: "relative",
              background: "#03170c",
              borderRadius: 8,
              padding: 20,
              maxHeight: "min(60vh, 520px)",
              overflowY: "auto",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.85), inset 0 0 3px #000",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
                mixBlendMode: "overlay",
                borderRadius: 8,
              }}
            />
            {selectedId && <MonitorBody companyId={companyId} agentId={selectedId} onClose={close} />}
          </div>
        </div>
        <div style={{ width: 90, height: 22, background: "linear-gradient(180deg, #b8b3a4, #9a9586)", clipPath: "polygon(15% 0, 85% 0, 100% 100%, 0 100%)" }} />
        <div style={{ width: 170, height: 10, background: "#9a9586", borderRadius: 3 }} />
      </div>
    </div>
  );
}

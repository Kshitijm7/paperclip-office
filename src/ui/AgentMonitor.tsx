import { useEffect, useState } from "react";
import { usePluginData, useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { useStore } from "../adapters/store.js";
import type { OfficeState } from "../shared/office.js";
import type { AgentDetail } from "../worker/agent-detail.js";

const POLL_MS = 4000;
const POWER_OFF_MS = 220;

const LED_COLOR: Record<OfficeState | "stuck", string> = {
  working: "oklch(72% 0.15 75)",
  thinking: "oklch(62% 0.12 220)",
  blocked: "oklch(62% 0.17 25)",
  idle: "oklch(55% 0 0)",
  stuck: "oklch(58% 0.22 25)",
};

const TABS = ["Status", "Issues", "Runs", "Terminal", "Team"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICON: Record<Tab, string> = { Status: "▣", Issues: "≡", Runs: "▶", Terminal: "⌨", Team: "⌥" };

export function ago(iso: string | null): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function snippet(text: string | null, chars: number): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > chars ? `${flat.slice(0, chars)}…` : flat;
}

function IssueLine({ issue }: { issue: { id: string; identifier: string | null; title: string; status: string } }) {
  const nav = useHostNavigation();
  return (
    <a {...nav.linkProps(`/issues/${issue.identifier ?? issue.id}`)} className="am-issue">
      {issue.identifier ?? issue.id.slice(0, 8)} <span className="am-issue-title">{issue.title}</span>
    </a>
  );
}

function StatusTab({ data }: { data: AgentDetail }) {
  const { office, manager, runs } = data;
  return (
    <div>
      {office.progress !== null && (
        <div className="am-block">
          <div className="am-progress-track">
            <div className="am-progress-fill" style={{ width: `${Math.round(office.progress * 100)}%` }} />
          </div>
          <div className="am-dim">{Math.round(office.progress * 100)}% of subtasks done</div>
        </div>
      )}
      <div className="am-label">{office.stuck ? `Stuck: ${office.stuckReason}` : `${office.state}${office.since ? ` · ${ago(office.since)}` : ""}`}</div>
      {office.issue ? (
        <IssueLine issue={{ id: office.issue.id, identifier: office.issue.label, title: office.issue.title, status: office.issue.status }} />
      ) : (
        <span className="am-dim">no current issue</span>
      )}
      <div className="am-label" style={{ marginTop: 14 }}>
        Reports to {manager ? <span className="am-strong">{manager.name}</span> : "no one"}
      </div>
      {runs[0]?.stdoutExcerpt && (
        <>
          <div className="am-label" style={{ marginTop: 14 }}>Latest output</div>
          <div className="am-dim">{snippet(runs[0].stdoutExcerpt, 160)}</div>
        </>
      )}
    </div>
  );
}

function IssuesTab({ data }: { data: AgentDetail }) {
  return (
    <div>
      <div className="am-label">Open ({data.openIssues.length})</div>
      {data.openIssues.length === 0 && <span className="am-dim">none</span>}
      {data.openIssues.map((i) => <IssueLine key={i.id} issue={i} />)}
      <div className="am-label" style={{ marginTop: 14 }}>Recently done ({data.doneIssues.length})</div>
      {data.doneIssues.length === 0 && <span className="am-dim">none</span>}
      {data.doneIssues.map((i) => <IssueLine key={i.id} issue={i} />)}
    </div>
  );
}

function RunsTab({ data }: { data: AgentDetail }) {
  return (
    <div>
      {data.runs.length === 0 && <span className="am-dim">none</span>}
      {data.runs.map((r) => (
        <div key={r.runId} className="am-run">
          <div className="am-run-head">
            <span>{r.status}{r.invocationSource ? ` · ${r.invocationSource}` : ""}</span>
            <span className="am-dim">{ago(r.startedAt)}</span>
          </div>
          {r.error && <div className="am-error">{r.error}</div>}
        </div>
      ))}
    </div>
  );
}

function TerminalTab({ data }: { data: AgentDetail }) {
  const text = data.runs[0]?.stdoutExcerpt;
  return text ? <pre className="am-terminal">{text}</pre> : <span className="am-dim">no output captured</span>;
}

function TeamTab({ data }: { data: AgentDetail }) {
  return (
    <div>
      <div className="am-label">Manager</div>
      <div className="am-dim">{data.manager ? <span className="am-strong">{data.manager.name}</span> : "no one"}</div>
      <div className="am-label" style={{ marginTop: 14 }}>Reports ({data.reports.length})</div>
      {data.reports.length === 0 && <span className="am-dim">none</span>}
      {data.reports.map((r) => <div key={r.id} className="am-dim">{r.name}</div>)}
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function MonitorScreen({ companyId, agentId, onClose }: { companyId: string; agentId: string; onClose: () => void }) {
  const { data, refresh } = usePluginData<AgentDetail>("agent", { companyId, agentId });
  const [tab, setTab] = useState<Tab>("Status");
  const clock = useClock();

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!data) return <div className="am-connecting">connecting...</div>;

  const { agent, office } = data;
  const led = office.stuck ? LED_COLOR.stuck : LED_COLOR[office.state];

  return (
    <div className="am-desktop">
      <div className="am-topbar">
        <span className="am-led" style={{ background: led, boxShadow: `0 0 6px 1px ${led}` }} aria-hidden="true" />
        <span className="am-topbar-name">{agent.name}</span>
        <span className="am-badge">{office.levelName}</span>
        <span className="am-topbar-spacer" />
        <span className="am-clock">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div className="am-body">
        <div className="am-dock" role="tablist" aria-label="Agent views">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`am-dock-item${tab === t ? " is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              <span className="am-dock-icon" aria-hidden="true">{TAB_ICON[t]}</span>
              <span className="am-dock-label">{t}</span>
            </button>
          ))}
        </div>
        <div className="am-window">
          <div className="am-window-titlebar">
            <span className="am-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="am-window-title">{tab}</span>
            <button className="am-window-close" onClick={onClose} aria-label="Close monitor">x</button>
          </div>
          <div className="am-window-body">
            {tab === "Status" && <StatusTab data={data} />}
            {tab === "Issues" && <IssuesTab data={data} />}
            {tab === "Runs" && <RunsTab data={data} />}
            {tab === "Terminal" && <TerminalTab data={data} />}
            {tab === "Team" && <TeamTab data={data} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Styled as a pixel-art desk monitor: charcoal bezel with a thick chin, neck, base and a CRT power animation. */
export function AgentMonitor({ companyId }: { companyId: string }) {
  const selectedId = useStore((s) => s.selectedId);
  const [renderedId, setRenderedId] = useState<string | null>(null);
  const [poweredOn, setPoweredOn] = useState(false);

  useEffect(() => {
    if (selectedId) {
      setRenderedId(selectedId);
      const raf = requestAnimationFrame(() => setPoweredOn(true));
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [selectedId]);

  const close = () => {
    setPoweredOn(false);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      useStore.setState({ selectedId: null });
      setRenderedId(null);
    }, reduced ? 0 : POWER_OFF_MS);
  };

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  if (!renderedId) return null;

  return (
    <div className="am-backdrop" onClick={close}>
      <style>{AM_CSS}</style>
      <div className="am-shell" onClick={(e) => e.stopPropagation()}>
        <div className="am-bezel">
          <div className="am-screen-area">
            <div className={`am-crt${poweredOn ? " is-on" : ""}`}>
              <div className="am-scanlines" aria-hidden="true" />
              <div className="am-vignette" aria-hidden="true" />
              <MonitorScreen companyId={companyId} agentId={renderedId} onClose={close} />
            </div>
          </div>
          <div className="am-chin">
            <span className="am-chin-led" aria-hidden="true" />
            <span className="am-chin-brand">paperclip</span>
          </div>
        </div>
        <div className="am-neck" />
        <div className="am-base" />
      </div>
    </div>
  );
}

const AM_CSS = `
.am-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.am-shell { display: flex; flex-direction: column; align-items: center; width: min(92vw, 880px); font-family: var(--font-mono, monospace); }
.am-bezel { width: 100%; background: #2b2d31; border: 3px solid #17181a; box-shadow: 4px 4px 0 #17181a, inset 0 0 0 2px #3c3f45; padding: 14px 14px 0; }
.am-screen-area { position: relative; width: 100%; aspect-ratio: 16 / 10; background: #000; overflow: hidden; border: 2px solid #101113; }
.am-chin { display: flex; align-items: center; gap: 8px; padding: 8px 10px; }
.am-chin-led { width: 8px; height: 8px; border-radius: 50%; background: #5fdc7a; box-shadow: 0 0 5px 1px #5fdc7a; flex: none; }
.am-chin-brand { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8d93; }
.am-neck { width: 90px; height: 20px; background: #2b2d31; border: 3px solid #17181a; border-top: none; clip-path: polygon(15% 0, 85% 0, 100% 100%, 0 100%); }
.am-base { width: 180px; height: 12px; background: #2b2d31; border: 3px solid #17181a; border-top: none; }
.am-crt { position: absolute; inset: 0; transform: scaleY(0.02); opacity: 0; transition: transform 220ms ease-out, opacity 120ms ease-out; }
.am-crt.is-on { transform: scaleY(1); opacity: 1; }
@media (prefers-reduced-motion: reduce) { .am-crt { transition: none; transform: scaleY(1); opacity: 1; } }
.am-scanlines { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px); mix-blend-mode: overlay; z-index: 2; }
.am-vignette { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 60px 12px rgba(0,0,0,0.85); z-index: 2; }
.am-connecting { color: #5fdc7a; padding: 20px; font-size: 13px; }
.am-desktop { position: absolute; inset: 0; display: flex; flex-direction: column; background: #03170c; color: #c9ffd6; font-size: 12px; }
.am-topbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #051f10; border-bottom: 1px solid #1f4a2c; flex: none; }
.am-led { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.am-topbar-name { color: #eafff0; font-weight: 600; }
.am-badge { font-size: 10px; padding: 1px 6px; border: 1px solid #1f4a2c; color: #9df0b0; }
.am-topbar-spacer { flex: 1; }
.am-clock { color: #5fdc7a99; }
.am-body { flex: 1; display: flex; min-height: 0; }
.am-dock { display: flex; flex-direction: column; gap: 2px; padding: 8px 4px; background: #02130a; border-right: 1px solid #1f4a2c; flex: none; overflow-y: auto; }
.am-dock-item { display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: 1px solid transparent; color: #5fdc7a99; cursor: pointer; padding: 6px 8px; font-family: inherit; font-size: 9px; }
.am-dock-item.is-active { color: #eafff0; border-color: #1f4a2c; background: #0a2a16; }
.am-dock-icon { font-size: 14px; }
.am-window { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.am-window-titlebar { display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: #0a2a16; border-bottom: 1px solid #1f4a2c; flex: none; }
.am-dots { display: flex; gap: 3px; }
.am-dots i { width: 6px; height: 6px; border-radius: 50%; background: #1f4a2c; display: block; }
.am-window-title { color: #9df0b0; flex: 1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
.am-window-close { background: none; border: 1px solid #1f4a2c; color: #9df0b0; cursor: pointer; font-family: inherit; padding: 1px 6px; }
.am-window-body { flex: 1; overflow-y: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: #1f4a2c #02130a; }
.am-window-body::-webkit-scrollbar { width: 8px; }
.am-window-body::-webkit-scrollbar-track { background: #02130a; }
.am-window-body::-webkit-scrollbar-thumb { background: #1f4a2c; border: 1px solid #02130a; }
.am-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #5fdc7a; opacity: 0.7; margin-bottom: 6px; }
.am-dim { color: #5fdc7a99; }
.am-strong { color: #c9ffd6; }
.am-block { margin-bottom: 14px; }
.am-progress-track { width: 100%; height: 5px; background: #1f4a2c; overflow: hidden; }
.am-progress-fill { height: 100%; background: #5fdc7a; }
.am-issue { display: block; color: #9df0b0; text-decoration: none; font-size: 13px; padding: 3px 0; }
.am-issue-title { color: #5fdc7a99; }
.am-run { border-top: 1px solid #1f4a2c; padding: 6px 0; }
.am-run-head { display: flex; justify-content: space-between; color: #9df0b0; }
.am-error { color: oklch(72% 0.19 30); font-size: 12px; }
.am-terminal { white-space: pre-wrap; word-break: break-word; background: #02130a; border: 1px solid #1f4a2c; padding: 10px; font-size: 12px; color: #9df0b0; margin: 0; }
@media (max-width: 480px) {
  .am-body { flex-direction: column; }
  .am-dock { flex-direction: row; width: 100%; border-right: none; border-bottom: 1px solid #1f4a2c; overflow-x: auto; overflow-y: hidden; }
  .am-dock-item { flex-direction: row; }
}
`;

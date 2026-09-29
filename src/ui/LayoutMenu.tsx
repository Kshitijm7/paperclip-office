import { useEffect, useRef, useState } from "react";
import { useHostNavigation, usePluginAction } from "@paperclipai/plugin-sdk/ui";
import { AGENT_PRESET, REQUEST_LAYOUT_ACTION, SET_LAYOUT_ACTION, type EffectiveLayout, type LayoutChoice } from "../shared/layout.js";
import { tokens } from "./tokens.js";
import { HAS_LIMEZU } from "../shared/art.js";

const ICON = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true } as const;
const LayoutIcon = () => <svg {...ICON}><rect x="2" y="2" width="12" height="12" /><path d="M2 7h7M9 2v12M9 10h5" /></svg>;
const CLOSED = new Set(["done", "cancelled"]);

const item = (active: boolean) => ({
  display: "block",
  width: "100%",
  textAlign: "left" as const,
  padding: "6px 10px",
  border: "none",
  background: active ? tokens.accent : "transparent",
  color: "inherit",
  font: "inherit",
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  cursor: "pointer",
});

export function LayoutMenu({ companyId, layout, agentLayouts, onPick, buttonStyle }: {
  companyId: string;
  layout: EffectiveLayout;
  agentLayouts: boolean;
  onPick: (choice: LayoutChoice) => void;
  buttonStyle: React.CSSProperties;
}) {
  const nav = useHostNavigation();
  const setLayout = usePluginAction(SET_LAYOUT_ACTION);
  const requestLayout = usePluginAction(REQUEST_LAYOUT_ACTION);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(choice: LayoutChoice) {
    onPick(choice);
    setOpen(false);
    setLayout({ companyId, ...choice }).catch((err: Error) => setNote(`Could not save the layout: ${err.message}`));
  }

  async function ask() {
    setNote("Creating the request...");
    try {
      const r = (await requestLayout({ companyId })) as { message?: string };
      setNote(r.message ?? null);
    } catch (err) {
      setNote(`Could not create the request: ${(err as Error).message}`);
    }
  }

  const is = (theme: string, preset?: string) => layout.theme === theme && (preset === undefined || layout.preset === preset);
  const agentTheme = layout.theme === "free" || !HAS_LIMEZU ? "free" : "generated";
  const req = layout.request;
  const reqOpen = req && !CLOSED.has(req.status ?? "");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" style={buttonStyle} title="Layout" aria-label="Layout" aria-expanded={open} onClick={() => setOpen(!open)}>
        <LayoutIcon />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", right: 38, top: 0, width: 260, maxHeight: "60vh", overflowY: "auto",
            border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, background: tokens.surface, color: tokens.foreground,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)", padding: "4px 0",
          }}
        >
          {HAS_LIMEZU && <button type="button" role="menuitem" style={item(is("office"))} onClick={() => pick({ theme: "office", preset: layout.preset })}>Mifflin office</button>}
          {HAS_LIMEZU && layout.presets.map((p) => (
            <button key={p.id} type="button" role="menuitem" style={item(is("generated", p.id))} onClick={() => pick({ theme: "generated", preset: p.id })}>
              {p.label}
            </button>
          ))}
          {layout.presets.map((p) => (
            <button key={`free-${p.id}`} type="button" role="menuitem" style={item(is("free", p.id))} onClick={() => pick({ theme: "free", preset: p.id })}>
              Free art (Kenney): {p.label}
            </button>
          ))}
          {layout.agent && (
            <button type="button" role="menuitem" style={item(is(agentTheme, AGENT_PRESET))} onClick={() => pick({ theme: agentTheme, preset: AGENT_PRESET })}>
              Agent-designed
              <div style={{ fontSize: 11, fontWeight: 400, color: tokens.mutedForeground, marginTop: 2 }}>
                by {layout.agent.agentName ?? layout.agent.agentId}: {layout.agent.rationale}
              </div>
            </button>
          )}
          {agentLayouts && (
            <div style={{ borderTop: `1px solid ${tokens.border}`, marginTop: 4, paddingTop: 4, fontSize: 12 }}>
              {reqOpen ? (
                <div style={{ padding: "6px 10px", color: tokens.mutedForeground }}>
                  Layout request{" "}
                  <a {...nav.linkProps(`/issues/${req.identifier ?? req.issueId}`)} style={{ color: "inherit" }}>{req.identifier ?? "issue"}</a>
                  {req.status ? `: ${req.status.replace("_", " ")}` : ""}
                </div>
              ) : (
                <button type="button" role="menuitem" style={item(false)} onClick={ask}>Ask an agent to design…</button>
              )}
              {note && <div style={{ padding: "4px 10px", color: tokens.mutedForeground }}>{note}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

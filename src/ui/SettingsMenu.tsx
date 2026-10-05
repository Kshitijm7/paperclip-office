import { useEffect, useRef, useState } from "react";
import { usePluginAction } from "@paperclipai/plugin-sdk/ui";
import { SET_PREFS_ACTION, type Prefs } from "../shared/prefs.js";
import type { OfficeSettings } from "../shared/settings.js";
import { tokens } from "./tokens.js";

const ICON = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true } as const;
const GearIcon = () => <svg {...ICON}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" /></svg>;

type Toggle = { key: keyof Prefs; label: string };
type Choice = { key: keyof Prefs; label: string; options: { value: string | number; label: string }[] };

const TOGGLES: Toggle[] = [
  { key: "nameplates", label: "Name plates" },
  { key: "issueTags", label: "Issue tags" },
  { key: "stateRings", label: "State rings" },
  { key: "chatter", label: "Chatter" },
  { key: "heatmap", label: "Heatmap" },
  { key: "rosterSidebar", label: "Roster sidebar" },
  { key: "activityFeed", label: "Activity feed" },
  { key: "paEnabled", label: "PA checks" },
  { key: "paReports", label: "PA reports" },
];

const minutes = (values: number[]) => values.map((v) => ({ value: v, label: v >= 60 ? `${v / 60} h` : `${v} min` }));
const seconds = (values: number[]) => values.map((v) => ({ value: v, label: `${v} s` }));

const CHOICES: Choice[] = [
  { key: "bubbles", label: "Bubble text", options: [{ value: "activity", label: "Activity" }, { value: "issue", label: "Issue" }, { value: "output", label: "Output" }] },
  { key: "idleRoaming", label: "Idle roaming", options: [{ value: "off", label: "Off" }, { value: "calm", label: "Calm" }, { value: "lively", label: "Lively" }] },
  { key: "paIntervalMinutes", label: "PA interval", options: minutes([5, 10, 15, 30, 60, 120, 360, 1440]) },
  { key: "pollSeconds", label: "Refresh", options: seconds([2, 4, 10, 30, 60]) },
  { key: "stuckMinutes", label: "Stuck after", options: minutes([5, 10, 15, 30, 60, 120]) },
];

const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "5px 10px", fontSize: 13 } as const;
const select = { font: "inherit", fontSize: 12, background: "transparent", color: "inherit", border: `1px solid ${tokens.border}`, borderRadius: 4, padding: "2px 4px" } as const;

/** Gear button with a popup of the settings people flip most; saved per company and layered over the plugin config. */
export function SettingsMenu({ companyId, settings, onChange, buttonStyle }: {
  companyId: string;
  settings: OfficeSettings;
  onChange: (patch: Prefs) => void;
  buttonStyle: React.CSSProperties;
}) {
  const save = usePluginAction(SET_PREFS_ACTION);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function set(patch: Prefs) {
    onChange(patch);
    setNote(null);
    save({ companyId, ...patch }).catch((err: Error) => setNote(`Could not save: ${err.message}`));
  }

  const bubblesOn = settings.bubbles !== "none";
  const options = (c: Choice) => (c.options.some((o) => String(o.value) === String(settings[c.key])) ? c.options : [...c.options, { value: settings[c.key] as string | number, label: String(settings[c.key]) }]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" style={buttonStyle} title="Settings" aria-label="Settings" aria-expanded={open} onClick={() => setOpen(!open)}>
        <GearIcon />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 38, bottom: 0, width: 240, maxHeight: "70vh", overflowY: "auto", padding: "6px 0", background: tokens.surface, color: tokens.foreground, border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          <label style={row}>
            <span>Thought bubbles</span>
            <input type="checkbox" checked={bubblesOn} onChange={(e) => set({ bubbles: e.target.checked ? "activity" : "none" })} />
          </label>
          {CHOICES.map((c) => (
            <label key={c.key} style={row}>
              <span>{c.label}</span>
              <select
                style={select}
                value={String(settings[c.key])}
                disabled={c.key === "bubbles" && !bubblesOn}
                onChange={(e) => set({ [c.key]: typeof settings[c.key] === "number" ? Number(e.target.value) : e.target.value } as Prefs)}
              >
                {options(c).map((o) => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
              </select>
            </label>
          ))}
          <div style={{ borderTop: `1px solid ${tokens.border}`, margin: "4px 0" }} />
          {TOGGLES.map((t) => (
            <label key={t.key} style={row}>
              <span>{t.label}</span>
              <input type="checkbox" checked={Boolean(settings[t.key])} onChange={(e) => set({ [t.key]: e.target.checked } as Prefs)} />
            </label>
          ))}
          {note && <div style={{ padding: "4px 10px", fontSize: 12, color: tokens.destructive }}>{note}</div>}
        </div>
      )}
    </div>
  );
}

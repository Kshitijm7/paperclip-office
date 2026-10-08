import { useEffect, useRef, useState } from "react";
import { usePluginAction } from "@paperclipai/plugin-sdk/ui";
import { PA_PREF_KEYS, RESET_PREFS_ACTION, SET_PREFS_ACTION, type Prefs } from "../shared/prefs.js";
import type { OfficeSettings } from "../shared/settings.js";
import { tokens } from "./tokens.js";

const ICON = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true } as const;
const GearIcon = () => <svg {...ICON} viewBox="0 0 24 24" strokeWidth={2}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>;

type PrefKey = keyof Prefs | (typeof PA_PREF_KEYS)[number];
type Toggle = { key: PrefKey; label: string };
type Choice = { key: PrefKey; label: string; options: { value: string | number; label: string }[] };

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

const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "3px 10px", fontSize: 13 } as const;
const select = { font: "inherit", fontSize: 12, background: "transparent", color: "inherit", border: `1px solid ${tokens.border}`, borderRadius: 4, padding: "2px 4px" } as const;

function ago(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

function paStatus(lastRunAt: string | null | undefined, intervalMinutes: number): string {
  if (!lastRunAt) return "PA has not run yet";
  const since = Date.now() - Date.parse(lastRunAt);
  const left = intervalMinutes * 60_000 - since;
  return `PA ran ${ago(since)}${since < 60_000 ? "" : " ago"}, next ${left <= 0 ? "due now" : `in ${ago(left)}`}`;
}

/** Gear button with a popup of the settings people flip most; saved per company and layered over the plugin config. */
export function SettingsMenu({ companyId, settings, paLastRunAt, onChange, onReset, buttonStyle }: {
  companyId: string;
  settings: OfficeSettings;
  paLastRunAt?: string | null;
  onChange: (patch: Prefs) => void;
  onReset: (served: OfficeSettings) => void;
  buttonStyle: React.CSSProperties;
}) {
  const save = usePluginAction(SET_PREFS_ACTION);
  const reset = usePluginAction(RESET_PREFS_ACTION);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [box, setBox] = useState<{ bottom: number; maxHeight: number }>({ bottom: 0, maxHeight: 400 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Pin the popup to the scene's bottom edge and cap its height to the scene, so no row is clipped.
  function openMenu() {
    const scene = ref.current?.parentElement?.offsetParent?.getBoundingClientRect();
    const gear = ref.current?.getBoundingClientRect();
    if (scene && gear) setBox({ bottom: gear.bottom - scene.bottom + 10, maxHeight: scene.height - 20 });
    setOpen(!open);
  }

  function set(patch: Prefs) {
    onChange(patch);
    setNote(null);
    save({ companyId, ...patch }).catch((err: Error) => setNote(`Could not save: ${err.message}`));
  }

  function resetAll() {
    setNote(null);
    reset({ companyId }).then((s) => onReset(s as OfficeSettings), (err: Error) => setNote(`Could not reset: ${err.message}`));
  }

  const bubblesOn = settings.bubbles !== "none";
  const options = (c: Choice) => (c.options.some((o) => String(o.value) === String(settings[c.key])) ? c.options : [...c.options, { value: settings[c.key] as string | number, label: String(settings[c.key]) }]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" style={buttonStyle} title="Settings" aria-label="Settings" aria-expanded={open} onClick={openMenu}>
        <GearIcon />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 38, bottom: box.bottom, width: 250, maxHeight: box.maxHeight, overflowY: "auto", padding: "6px 0", background: tokens.surface, color: tokens.foreground, border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
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
          {settings.paEnabled && <div style={{ padding: "4px 10px", fontSize: 12, color: tokens.mutedForeground }}>{paStatus(paLastRunAt, settings.paIntervalMinutes)}</div>}
          <div style={{ padding: "4px 10px" }}>
            <button type="button" onClick={resetAll} style={{ ...select, cursor: "pointer", padding: "3px 8px" }}>Reset to defaults</button>
          </div>
          {note && <div style={{ padding: "4px 10px", fontSize: 12, color: tokens.destructive }}>{note}</div>}
        </div>
      )}
    </div>
  );
}

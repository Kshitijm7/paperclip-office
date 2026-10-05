import { useEffect, useState } from "react";
import { useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { fitWholeFloor, zoomBy, ZOOM_STEP } from "../overrides/Camera.js";
import { useStore } from "../adapters/store.js";
import { SEARCH_OPEN_EVENT } from "./AgentSearch.js";
import { LayoutMenu } from "./LayoutMenu.js";
import { SettingsMenu } from "./SettingsMenu.js";
import type { Prefs } from "../shared/prefs.js";
import type { OfficeSettings } from "../shared/settings.js";
import type { EffectiveLayout, LayoutChoice } from "../shared/layout.js";

// Upstream's in-scene boards ask to open a command-centre tab; these are the Paperclip pages that play that role.
// "human" opens the Decision box in-scene instead of navigating away.
const TAB_ROUTES: Record<string, string> = { tasks: "/issues", triggers: "/routines" };

const button = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  font: "inherit",
  fontSize: 16,
  lineHeight: 1,
  border: "1px solid var(--border, #444)",
  background: "var(--card, #222)",
  color: "var(--foreground, #eee)",
  cursor: "pointer",
} as const;

const ICON = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true } as const;
const EnterFullscreen = () => <svg {...ICON}><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>;
const ExitFullscreen = () => <svg {...ICON}><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" /></svg>;
const SearchIcon = () => <svg {...ICON}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>;
const DecisionIcon = () => <svg {...ICON}><path d="M8 2 2 8l6 6 6-6-6-6Z" /><path d="M8 5.5v3.2M8 10.8h.01" /></svg>;

export interface LayoutControl { companyId: string; layout: EffectiveLayout; agentLayouts: boolean; onPick: (choice: LayoutChoice) => void }

export interface SettingsControl { companyId: string; settings: OfficeSettings; paLastRunAt?: string | null; onChange: (patch: Prefs) => void; onReset: (served: OfficeSettings) => void }

export function SceneControls({ sceneRef, search, layout, decisionCount, prefs }: { sceneRef: React.RefObject<HTMLDivElement | null>; search: boolean; layout?: LayoutControl | null; decisionCount?: number; prefs?: SettingsControl | null }) {
  const nav = useHostNavigation();
  const [full, setFull] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    useStore.setState({
      requestCommandCenterTab: (tab: string) => {
        if (tab === "human") { useStore.setState({ decisionBoxOpen: true }); return; }
        if (TAB_ROUTES[tab]) nav.navigate(`/${window.location.pathname.split("/")[1]}${TAB_ROUTES[tab]}`);
      },
    });
    // Closing the monitor clears the selection; return to the whole floor then.
    return useStore.subscribe((s, prev) => {
      if (prev.selectedId && !s.selectedId) fitWholeFloor();
    });
  }, [nav]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void sceneRef.current?.requestFullscreen();
  }

  return (
    <div style={{ position: "absolute", right: 10, bottom: 10, zIndex: 3, display: "flex", flexDirection: "column", gap: 4 }}>
      {typeof decisionCount === "number" && (
        <button
          type="button"
          style={{ ...button, position: "relative" }}
          title="Decisions"
          aria-label={`Decisions (${decisionCount})`}
          onClick={() => useStore.setState({ decisionBoxOpen: true })}
        >
          <DecisionIcon />
          {decisionCount > 0 && (
            <span
              style={{
                position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, padding: "0 3px",
                borderRadius: 8, background: "var(--destructive, #d9534f)", color: "#fff",
                fontSize: 10, lineHeight: "16px", textAlign: "center",
              }}
            >
              {decisionCount}
            </span>
          )}
        </button>
      )}
      {prefs && <SettingsMenu {...prefs} buttonStyle={button} />}
      {layout && <LayoutMenu {...layout} buttonStyle={button} />}
      {search && (
        <button type="button" style={button} title="Search agents (/)" aria-label="Search agents" onClick={() => window.dispatchEvent(new Event(SEARCH_OPEN_EVENT))}>
          <SearchIcon />
        </button>
      )}
      <button type="button" style={button} title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
      <button type="button" style={button} title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>−</button>
      <button type="button" style={button} title="Whole floor" aria-label="Whole floor" onClick={fitWholeFloor}>⤢</button>
      <button type="button" style={button} title={full ? "Exit fullscreen" : "Fullscreen"} aria-label={full ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
        {full ? <ExitFullscreen /> : <EnterFullscreen />}
      </button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { fitWholeFloor, zoomBy, ZOOM_STEP } from "../overrides/Camera.js";
import { useStore } from "../adapters/store.js";
import { SEARCH_OPEN_EVENT } from "./AgentSearch.js";
import { LayoutMenu } from "./LayoutMenu.js";
import type { EffectiveLayout, LayoutChoice } from "../shared/layout.js";

// Upstream's in-scene boards ask to open a command-centre tab; these are the Paperclip pages that play that role.
const TAB_ROUTES: Record<string, string> = { human: "/inbox", tasks: "/issues", triggers: "/routines" };

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

export interface LayoutControl { companyId: string; layout: EffectiveLayout; agentLayouts: boolean; onPick: (choice: LayoutChoice) => void }

export function SceneControls({ sceneRef, search, layout }: { sceneRef: React.RefObject<HTMLDivElement | null>; search: boolean; layout?: LayoutControl | null }) {
  const nav = useHostNavigation();
  const [full, setFull] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    useStore.setState({ requestCommandCenterTab: (tab: string) => TAB_ROUTES[tab] && nav.navigate(TAB_ROUTES[tab]) });
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

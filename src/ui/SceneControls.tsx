import { useEffect, useState } from "react";
import { useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { fitWholeFloor, zoomBy, ZOOM_STEP } from "../overrides/Camera.js";
import { useStore } from "../adapters/store.js";

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

export function SceneControls({ sceneRef }: { sceneRef: React.RefObject<HTMLDivElement | null> }) {
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
      <button type="button" style={button} title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
      <button type="button" style={button} title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>−</button>
      <button type="button" style={button} title="Whole floor" aria-label="Whole floor" onClick={fitWholeFloor}>⤢</button>
      <button type="button" style={button} title={full ? "Exit fullscreen" : "Fullscreen"} aria-label={full ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}>
        {full ? "⤡" : "⛶"}
      </button>
    </div>
  );
}

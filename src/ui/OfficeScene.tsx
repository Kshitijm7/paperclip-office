import { useEffect, useRef, useState } from "react";
import { OfficeFloor } from "../../vendor/munder-difflin/src/renderer/src/scene/office/OfficeFloor.js";
import { useStore } from "../adapters/store.js";
import { setChatter, setLanguage } from "../adapters/i18n.js";
import { setHeatmapSettings } from "./heatmapLayer.js";
import type { OfficeData } from "../shared/office.js";
import type { EffectiveLayout } from "../shared/layout.js";
import { setGeneratedDepartments } from "../layout/provider.js";
import { FREE_THEME_ID, GENERATED_THEME_ID } from "../layout/theme.js";
import { availableTheme } from "../shared/art.js";
import { hash, mulberry32, sceneDepartments, toSceneAgents, boardTasks } from "./scene-bridge.js";

type HiveMessage = { from: string; targets: string[]; act: "request"; needsHuman: boolean };

// Upstream's floor reads its task board and message feed from an Electron preload bridge named `cth`.
function installBridge(getData: () => OfficeData | undefined) {
  const listeners = new Set<(e: HiveMessage) => void>();
  (window as any).cth = {
    hiveTasks: async () => { const d = getData(); return { tasks: d ? boardTasks(d) : [] }; },
    onHiveMessage: (fn: (e: HiveMessage) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return (e: HiveMessage) => listeners.forEach((fn) => fn(e));
}

export function OfficeScene({ companyId, data, layout }: { companyId: string; data: OfficeData | undefined; layout?: EffectiveLayout }) {
  const dataRef = useRef(data);
  dataRef.current = data;
  const [emit, setEmit] = useState<((e: HiveMessage) => void) | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const realRandom = Math.random;
    Math.random = mulberry32(hash(companyId));
    setEmit(() => installBridge(() => dataRef.current));
    return () => {
      Math.random = realRandom;
      delete (window as any).cth;
    };
  }, [companyId]);

  const rawTheme = layout?.theme ?? data?.settings.theme;
  const themeSetting = rawTheme && availableTheme(rawTheme);
  useEffect(() => {
    if (themeSetting) useStore.setState({ officeTheme: themeSetting === "generated" ? GENERATED_THEME_ID : themeSetting === "free" ? FREE_THEME_ID : themeSetting });
  }, [themeSetting]);

  useEffect(() => {
    if (!data) return;
    const { settings } = data;
    setLanguage(settings.language);
    setChatter(settings.chatter);
    setHeatmapSettings(settings);
    useStore.getState().setAgents(toSceneAgents(data, settings));
    for (const h of data.handoffs) {
      const key = `${h.from}>${h.to}@${h.at}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      emit?.({ from: h.from, targets: [h.to], act: "request", needsHuman: false });
    }
  }, [data, emit]);

  // Upstream's first task-board poll is its baseline; mounting before data arrives animates every task as new.
  const theme = useStore((s) => s.officeTheme);
  const depts = data ? sceneDepartments(data) : [];
  setGeneratedDepartments(depts, layout?.spec);
  const layoutKey = theme === GENERATED_THEME_ID || theme === FREE_THEME_ID ? `${theme}|` + `${depts.map((d) => d.agentIds.length).join(",")}|${JSON.stringify(layout?.spec ?? null)}` : "fixed";

  if (!emit || !data) return null;
  return <OfficeFloor key={layoutKey} />;
}

import { useEffect, useRef, useState } from "react";
import { OfficeFloor } from "../../vendor/munder-difflin/src/renderer/src/scene/office/OfficeFloor.js";
import { useStore } from "../adapters/store.js";
import type { OfficeData } from "../shared/office.js";
import { fitWholeFloor } from "../overrides/Camera.js";
import { setGeneratedDepartments } from "../layout/provider.js";
import { GENERATED_THEME_ID } from "../layout/theme.js";
import { hash, mulberry32, sceneDepartments, toSceneAgents } from "./scene-bridge.js";

type HiveMessage = { from: string; targets: string[]; act: "request"; needsHuman: boolean };

// Upstream's floor reads its task board and message feed from an Electron preload bridge named `cth`.
function installBridge(getData: () => OfficeData | undefined) {
  const listeners = new Set<(e: HiveMessage) => void>();
  (window as any).cth = {
    hiveTasks: async () => ({ tasks: getData()?.tasks ?? [] }),
    onHiveMessage: (fn: (e: HiveMessage) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return (e: HiveMessage) => listeners.forEach((fn) => fn(e));
}

export function OfficeScene({ companyId, data }: { companyId: string; data: OfficeData | undefined }) {
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

  useEffect(() => {
    if (!data) return;
    useStore.getState().setAgents(toSceneAgents(data));
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
  setGeneratedDepartments(depts);
  const layoutKey = theme === GENERATED_THEME_ID ? depts.map((d) => d.agentIds.length).join(",") : "fixed";

  if (!emit || !data) return null;
  return (
    <>
      <OfficeFloor key={layoutKey} />
      <button
        type="button"
        onClick={fitWholeFloor}
        style={{ position: "absolute", top: 8, right: 8, zIndex: 2, font: "inherit", fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border, #444)", background: "var(--card, #222)", color: "var(--foreground, #eee)", cursor: "pointer" }}
      >
        Whole floor
      </button>
    </>
  );
}

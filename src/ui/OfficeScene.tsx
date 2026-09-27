import { useEffect, useRef, useState } from "react";
import { OfficeFloor } from "../../vendor/munder-difflin/src/renderer/src/scene/office/OfficeFloor.js";
import { useStore } from "../adapters/store.js";
import { setChatter, setLanguage } from "../adapters/i18n.js";
import type { OfficeData } from "../shared/office.js";
import { hash, mulberry32, toSceneAgents } from "./scene-bridge.js";

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
    const { settings } = data;
    setLanguage(settings.language);
    setChatter(settings.chatter);
    useStore.setState({ officeTheme: settings.theme === "generated" ? "office" : settings.theme });
    useStore.getState().setAgents(toSceneAgents(data, settings));
    for (const h of data.handoffs) {
      const key = `${h.from}>${h.to}@${h.at}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      emit?.({ from: h.from, targets: [h.to], act: "request", needsHuman: false });
    }
  }, [data, emit]);

  // Upstream's first task-board poll is its baseline; mounting before data arrives animates every task as new.
  if (!emit || !data) return null;
  return <OfficeFloor />;
}

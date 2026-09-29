import { useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import type { AccentColorName } from "./tokens.js";
import type { OfficeCharacterName } from "../../vendor/munder-difflin/src/renderer/src/scene/office/cast.js";
import type { ThemeId } from "../../vendor/munder-difflin/src/renderer/src/scene/office/themeRegistry.js";

export type StatusKind =
  | "idle" | "thinking" | "working" | "waiting" | "blocked"
  | "compacting" | "looping" | "success" | "ghost";

export type ToolKind =
  | "Read" | "Edit" | "Write" | "Bash" | "WebFetch" | "WebSearch"
  | "Grep" | "Glob" | "TodoWrite" | "MCP";

export interface Agent {
  id: string;
  name: string;
  character: OfficeCharacterName;
  accent: AccentColorName;
  description: string;
  status: StatusKind;
  action: string;
  progress: number;
  carrying?: ToolKind;
  lastPrompt?: string;
  isGod?: boolean;
  [extra: string]: unknown;
}

interface State {
  agents: Agent[];
  selectedId: string | null;
  officeTheme: ThemeId;
  fullscreenAgentId: string | null;
  ideOpen: boolean;
  decisionBoxOpen: boolean;
  rosterOpen: boolean;
  select: (id: string) => void;
  requestCommandCenterTab: (tab: string) => void;
  setAgents: (agents: Agent[]) => void;
}

const store = createStore<State>((set) => ({
  agents: [],
  selectedId: null,
  officeTheme: "office",
  fullscreenAgentId: null,
  ideOpen: false,
  decisionBoxOpen: false,
  rosterOpen: false,
  select: (id) => set({ selectedId: id }),
  requestCommandCenterTab: () => {},
  setAgents: (agents) => set({ agents }),
}));

// zustand's React binding pulls in a CommonJS shim that `require`s react, which the host cannot resolve.
function useBoundStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export const useStore = Object.assign(useBoundStore, {
  getState: store.getState,
  setState: store.setState,
  subscribe: store.subscribe,
});

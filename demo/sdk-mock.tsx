import { useEffect, useMemo, useState } from "react";
import type {
  PluginDataResult,
  PluginActionFn,
  HostNavigation,
  HostNavigationLinkProps,
  PluginHostContext,
} from "@paperclipai/plugin-sdk/ui";
import { DATA_KEY } from "../src/shared/office.js";
import { DECISIONS_DATA_KEY } from "../src/shared/decisions.js";
import { ACTIVITY_DATA_KEY } from "../src/shared/activity.js";
import { OFFICE_DATA, DECISIONS, ACTIVITY, RECOGNITION, agentDetail, COMPANY_ID, COMPANY_PREFIX } from "./fixtures.js";

function noop() {}

const FIXTURES: Record<string, unknown> = {
  [DATA_KEY]: OFFICE_DATA,
  [DECISIONS_DATA_KEY]: { items: DECISIONS },
  [ACTIVITY_DATA_KEY]: { events: ACTIVITY },
  recognition: RECOGNITION,
};

export function usePluginData<T = unknown>(key: string, params?: Record<string, unknown>): PluginDataResult<T> {
  const paramsKey = JSON.stringify(params ?? {});
  const resolved = useMemo(() => {
    if (key === "agent") {
      const agentId = String((params as { agentId?: string } | undefined)?.agentId ?? "");
      return agentDetail(agentId) as unknown as T;
    }
    return (FIXTURES[key] as T) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, paramsKey]);

  // The real bridge always answers over the network, at least one tick after mount effects have
  // already run. Returning `resolved` synchronously here (unlike production) let a scene mount
  // effect that depends on [data, emit] fire twice in quick succession before `emit` settled,
  // double-claiming office seats and stranding every non-idle agent at the entrance. Delaying by
  // a macrotask reproduces the real "data arrives after mount" timing (see docs/layouts.md,
  // "Everyone queues at the door").
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    setData(null);
    const timer = setTimeout(() => setData(resolved), 0);
    return () => clearTimeout(timer);
  }, [resolved]);

  return { data, loading: data === null, error: null, refresh: noop };
}

export function usePluginAction(_key: string): PluginActionFn {
  return async () => ({ ok: true });
}

export function useHostContext(): PluginHostContext {
  return {
    companyId: COMPANY_ID,
    companyPrefix: COMPANY_PREFIX,
    projectId: null,
    entityId: null,
    entityType: null,
    userId: "demo-user",
  };
}

export function useHostLocation() {
  return { pathname: `/${COMPANY_PREFIX}/plugins/office`, search: "", hash: "" };
}

export function usePluginStream<T = unknown>() {
  return { events: [] as T[], lastEvent: null, connecting: false, connected: false, error: null, close: noop };
}

export function usePluginToast() {
  return () => null;
}

export function useHostNavigation(): HostNavigation {
  return {
    resolveHref: (to: string) => to,
    navigate: noop,
    linkProps: (to: string): HostNavigationLinkProps => ({
      href: to,
      onClick: (e) => e.preventDefault(),
    }),
  };
}

export function copyTextToClipboard() {
  return Promise.resolve(true);
}

// Unused display components re-exported as harmless stubs, in case anything imports them.
export const MetricCard = () => null;
export const StatusBadge = () => null;
export const DataTable = () => null;
export const TimeseriesChart = () => null;
export const MarkdownBlock = ({ children }: { children?: string }) => <div>{children}</div>;
export const MarkdownEditor = () => null;
export const KeyValueList = () => null;
export const ActionBar = () => null;
export const LogView = () => null;
export const JsonTree = () => null;
export const Spinner = () => null;
export const ErrorBoundary = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const FileTree = () => null;
export const IssuesList = () => null;
export const AssigneePicker = () => null;
export const ProjectPicker = () => null;
export const ManagedRoutinesList = () => null;

export type {
  PluginPageProps,
  PluginWidgetProps,
  PluginSidebarProps,
  PluginHostContext,
  PluginDataResult,
  PluginActionFn,
  HostNavigation,
  HostNavigationLinkProps,
} from "@paperclipai/plugin-sdk/ui";

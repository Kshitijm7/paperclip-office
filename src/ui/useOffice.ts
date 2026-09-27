import { useEffect, useState } from "react";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";
import { DATA_KEY, type OfficeData } from "../shared/office.js";
import { DEFAULTS } from "../shared/settings.js";

const DEFAULT_POLL_MS = DEFAULTS.pollSeconds * 1000;

/** Keeps the last good snapshot, because data is empty while a refresh is in flight and the scene must not remount. */
export function useOffice(companyId: string) {
  const { data, error, refresh } = usePluginData<OfficeData>(DATA_KEY, { companyId });
  const [last, setLast] = useState<OfficeData | null>(null);
  useEffect(() => {
    if (data) setLast(data);
  }, [data]);
  const pollMs = (data ?? last)?.settings ? (data ?? last)!.settings.pollSeconds * 1000 : DEFAULT_POLL_MS;
  useEffect(() => {
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);
  return { data: data ?? last, error };
}

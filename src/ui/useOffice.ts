import { useEffect, useState } from "react";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";
import { DATA_KEY, type OfficeData } from "../shared/office.js";

const POLL_MS = 4000;

/** Keeps the last good snapshot, because data is empty while a refresh is in flight and the scene must not remount. */
export function useOffice(companyId: string) {
  const { data, error, refresh } = usePluginData<OfficeData>(DATA_KEY, { companyId });
  const [last, setLast] = useState<OfficeData | null>(null);
  useEffect(() => {
    if (data) setLast(data);
  }, [data]);
  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);
  return { data: data ?? last, error };
}

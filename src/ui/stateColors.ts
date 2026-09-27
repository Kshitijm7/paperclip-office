import type { OfficeState } from "../shared/office.js";

export const STATE_COLOR: Record<OfficeState | "stuck", string> = {
  working: "oklch(72% 0.15 75)",
  thinking: "oklch(62% 0.12 220)",
  blocked: "oklch(62% 0.17 25)",
  idle: "var(--muted-foreground)",
  stuck: "var(--destructive)",
};

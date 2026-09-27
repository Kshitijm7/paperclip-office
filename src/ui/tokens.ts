// Host token mapping: every color/radius/border here is a CSS variable reference, never a literal
// hex grey. Paperclip defines these on :root and swaps them under a .dark ancestor class.
export const tokens = {
  background: "var(--background)",
  surface: "var(--card)",
  surfaceForeground: "var(--card-foreground)",
  foreground: "var(--foreground)",
  mutedForeground: "var(--muted-foreground)",
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",
  accent: "var(--accent)",
  primary: "var(--primary)",
  destructive: "var(--destructive)",
  popover: "var(--popover)",
  radius: "var(--radius)",
  selected: "color-mix(in oklch, var(--primary) 12%, transparent)",
  prState: {
    open: "oklch(60% 0.17 145)",
    draft: "var(--muted-foreground)",
    merged: "oklch(60% 0.17 300)",
    closed: "var(--destructive)",
  },
} as const;

export type Tokens = typeof tokens;

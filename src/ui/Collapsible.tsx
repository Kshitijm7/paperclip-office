import { useState, type ReactNode } from "react";
import { tokens } from "./tokens.js";

function readOpen(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`office.panel.${key}`);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

/** A titled panel under the canvas that opens on demand, remembered per viewer. */
export function Collapsible({ id, title, hint, defaultOpen = false, children }: { id: string; title: string; hint?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(`office.panel.${id}`, open ? "0" : "1");
    } catch {}
  };
  return (
    <section style={{ border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, background: tokens.surface, minWidth: 0 }}>
      <button
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px",
          background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, fontWeight: 600,
        }}
      >
        <span>
          {title} {hint && <span style={{ color: tokens.mutedForeground, fontWeight: 400 }}>{hint}</span>}
        </span>
        <span style={{ color: tokens.mutedForeground }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div style={{ borderTop: `1px solid ${tokens.border}`, overflowX: "auto" }}>{children}</div>}
    </section>
  );
}

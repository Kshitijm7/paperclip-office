import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../adapters/store.js";
import { fuzzyFilterAgents, type SearchCandidate } from "./fuzzyMatch.js";
import type { OfficeData } from "../shared/office.js";
import { tokens } from "./tokens.js";

export const SEARCH_OPEN_EVENT = "office:search-open";
const MAX_RESULTS = 8;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

function candidatesFor(data: OfficeData): SearchCandidate[] {
  return data.agents.map((a) => ({
    id: a.id,
    label: a.name,
    haystack: [a.name, a.title, a.role, a.issue?.label, a.issue?.title].filter(Boolean).join(" "),
  }));
}

/** Press "/" (or the header search icon) to fuzzy-jump to an agent by name/title/issue. */
export function AgentSearch({ data }: { data: OfficeData | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openBox = () => {
      setQuery("");
      setActive(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        openBox();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_OPEN_EVENT, openBox);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_OPEN_EVENT, openBox);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    if (!data) return [];
    return fuzzyFilterAgents(query, candidatesFor(data)).slice(0, MAX_RESULTS);
  }, [data, query]);

  if (!open) return null;

  const pick = (id: string) => {
    useStore.getState().select(id);
    setOpen(false);
  };

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10%" }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ width: "min(420px, 90%)", background: tokens.surface, color: tokens.foreground, border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              pick(results[active].id);
            }
          }}
          placeholder="Jump to an agent, title, or issue…"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "none", borderBottom: `1px solid ${tokens.border}`, background: "transparent", color: "inherit", font: "inherit", fontSize: 14, outline: "none" }}
        />
        {results.length > 0 && (
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {results.map((r, i) => (
              <div
                key={r.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r.id)}
                style={{ padding: "8px 14px", cursor: "pointer", background: i === active ? tokens.selected : "transparent", fontSize: 13 }}
              >
                {r.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

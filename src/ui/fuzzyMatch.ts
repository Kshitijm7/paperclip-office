/** Subsequence fuzzy match, case-insensitive: every query char must appear in text, in order. */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export interface SearchCandidate {
  id: string;
  label: string;
  haystack: string;
}

/** Lower is better: label prefix, label word, label substring, other-field substring, then subsequence; null = no match. */
export function matchRank(query: string, c: SearchCandidate): number | null {
  const q = query.trim().toLowerCase();
  const label = c.label.toLowerCase();
  const hay = c.haystack.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q)) return 2;
  if (hay.includes(q)) return 3;
  return fuzzyMatch(q, hay) ? 4 : null;
}

export function fuzzyFilterAgents(query: string, candidates: SearchCandidate[]): SearchCandidate[] {
  if (!query.trim()) return [];
  return candidates
    .map((c) => ({ c, rank: matchRank(query, c) }))
    .filter((r): r is { c: SearchCandidate; rank: number } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.c.label.length - b.c.label.length)
    .map((r) => r.c);
}

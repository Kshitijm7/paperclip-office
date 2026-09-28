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

/** Matches by name/title/issue, shorter labels first among matches (closer to an exact hit). */
export function fuzzyFilterAgents(query: string, candidates: SearchCandidate[]): SearchCandidate[] {
  const q = query.trim();
  if (!q) return [];
  return candidates
    .filter((c) => fuzzyMatch(q, c.haystack))
    .sort((a, b) => a.haystack.length - b.haystack.length);
}

const STRINGS: Record<string, string | string[]> = {
  "office.gpuError": "The office lost its GPU context. Reload the page to bring it back.",
  "office.errand.water": ["watering the plants", "giving the plants a drink"],
  "office.errand.window": ["letting some air in", "a bit of fresh air"],
  "office.errand.dispenser": ["getting some water", "hydration break"],
  "office.errand.fridge": ["anything good in the fridge?", "just looking"],
  "office.errand.shelf": ["checking the shelf", "reading the docs"],
  "office.errand.bin": ["desk cleanup", "tidying up"],
  "office.errand.smoke": ["stepping out for a minute", "thinking big thoughts"],
  "office.suckUp": ["{{done}} issues closed this week", "plan looks solid", "on it now", "roadmap makes sense", "ready for the next one", "reviewed and merged", "queue is clear"],
  "office.gossip": ["that run took forever", "another quick sync", "who reassigned my issue?", "the review queue is long today", "backlog keeps growing", "is CI green yet?", "need another approval"],
  "office.cheer": ["done", "shipped", "merged", "that's a wrap", "closed it", "in review now", "next issue"],
  "office.mugs.empty": "no clean mugs left",
  "office.mugs.brewing": "brewing a fresh one",
  "office.mugs.washing": "washing the mug",
  "office.activity.waiting": "waiting",
  "office.activity.needsYou": "needs approval",
  "office.activity.compacting": "compacting context",
  "office.activity.looping": "looping",
  "office.activity.runningFloor": "running the company",
  "office.activity.idle": "idle",
};

function lookup(key: string): string | string[] | undefined {
  if (key in STRINGS) return STRINGS[key];
  const m = /^(.*)\.(\d+)$/.exec(key);
  const list = m ? STRINGS[m[1]] : undefined;
  return Array.isArray(list) ? list[Number(m![2]) % list.length] : undefined;
}

export function t(key: string, vars?: Record<string, unknown> & { returnObjects?: boolean }): any {
  const value = lookup(key) ?? key;
  if (Array.isArray(value)) return vars?.returnObjects ? value : value[0];
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars?.[name] ?? ""));
}

const i18n = { language: "en", dir: () => "ltr" };

export function useTranslation() {
  return { t, i18n };
}

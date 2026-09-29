// Downloads munder-difflin's LimeZu maps and tilesets into assets/local/ (gitignored, never published).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const lock = JSON.parse(readFileSync("upstream/upstream.lock.json", "utf8").replace(/^﻿/, ""));
const base = `https://raw.githubusercontent.com/chaitanyagiri/munder-difflin/${lock.commit}/src/renderer/src/assets/`;
const files = [
  "maps/office.tmj",
  "maps/brooklyn99.tmj",
  "tilesets/office-tileset.png",
  "tilesets/a5-office-floors-walls.png",
  "tilesets/interiors.png",
  "tilesets/LIMEZUASSETS-LICENSE.txt",
];

// Non-fatal: without this art the build still works and offers only the free (Kenney) theme.
for (const file of files) {
  const dest = join("assets/local", file);
  if (existsSync(dest)) continue;
  try {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log(`fetch-art: ${file}`);
  } catch (err) {
    console.warn(`fetch-art: skipped ${file} (${err.message}); LimeZu themes will be unavailable.`);
  }
}

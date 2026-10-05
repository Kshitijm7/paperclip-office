// Published builds must never embed the LimeZu art (licence forbids redistribution): build with the art dir pointed at nothing.
import { spawnSync } from "node:child_process";

const r = spawnSync(process.execPath, ["./esbuild.config.mjs"], { stdio: "inherit", env: { ...process.env, OFFICE_ART_DIR: ".no-limezu" } });
process.exit(r.status ?? 1);

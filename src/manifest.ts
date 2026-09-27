import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DEFAULT_STUCK_MINUTES, PAGE_ROUTE } from "./shared/office.js";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclip-office",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Office",
  description: "Your company as a live pixel office: every agent at a desk, work moving between them",
  author: "Kshitij Mittal",
  categories: ["ui"],
  capabilities: [
    "agents.read",
    "issues.read",
    "database.namespace.migrate",
    "database.namespace.read",
    "metrics.write",
    "ui.page.register",
    "ui.sidebar.register",
    "ui.dashboardWidget.register",
  ],
  database: {
    namespaceSlug: "office",
    migrationsDir: "migrations",
    coreReadTables: ["heartbeat_runs"],
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      stuckMinutes: {
        type: "number",
        title: "Stuck after (minutes)",
        description: "An agent with a live run and no output for this long is marked stuck.",
        default: DEFAULT_STUCK_MINUTES,
        minimum: 1,
        maximum: 240,
      },
    },
  },
  ui: {
    slots: [
      { type: "page", id: "office", displayName: "Office", exportName: "OfficePage", routePath: PAGE_ROUTE },
      { type: "sidebar", id: "nav", displayName: "Office", exportName: "SidebarLink" },
      { type: "dashboardWidget", id: "summary", displayName: "Office", exportName: "OfficeWidget" },
    ],
  },
};

export default manifest;

import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { PAGE_ROUTE } from "./shared/office.js";
import { DEFAULTS } from "./shared/settings.js";

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
      theme: {
        type: "string",
        title: "Theme",
        description: "The office's visual style.",
        enum: ["office", "brooklyn99", "generated"],
        default: DEFAULTS.theme,
      },
      stuckMinutes: {
        type: "number",
        title: "Stuck after (minutes)",
        description: "An agent with a live run and no output for this long is marked stuck.",
        default: DEFAULTS.stuckMinutes,
        minimum: 1,
        maximum: 240,
      },
      pollSeconds: {
        type: "number",
        title: "Refresh interval (seconds)",
        description: "How often the office polls for new data.",
        default: DEFAULTS.pollSeconds,
        minimum: 2,
        maximum: 60,
      },
      idleRoaming: {
        type: "string",
        title: "Idle roaming",
        description: "Whether idle agents wander the floor or stay seated at their desks.",
        enum: ["off", "calm", "lively"],
        default: DEFAULTS.idleRoaming,
      },
      chatter: {
        type: "boolean",
        title: "Chatter",
        description: "Show ambient small talk (gossip, cheers, errands) between agents.",
        default: DEFAULTS.chatter,
      },
      bubbles: {
        type: "string",
        title: "Thought bubbles",
        description: "What each agent's thought bubble shows.",
        enum: ["activity", "issue", "output", "none"],
        default: DEFAULTS.bubbles,
      },
      castStyle: {
        type: "string",
        title: "Cast style",
        description: "The character roster used for agents on the floor.",
        enum: ["office", "neutral"],
        default: DEFAULTS.castStyle,
      },
      language: {
        type: "string",
        title: "Language",
        description: "Language for on-screen office text.",
        enum: ["en", "ar", "zh-CN"],
        default: DEFAULTS.language,
      },
      showOrgPanel: {
        type: "boolean",
        title: "Show org panel",
        description: "Show the department/org-chart panel below the office.",
        default: DEFAULTS.showOrgPanel,
      },
      showStateBoard: {
        type: "boolean",
        title: "Show state board",
        description: "Show the per-agent state table below the office.",
        default: DEFAULTS.showStateBoard,
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

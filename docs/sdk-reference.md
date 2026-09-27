# Plugin SDK reference, condensed

The full reference is `node_modules/@paperclipai/plugin-sdk/README.md` (about 1300 lines) and the types in `dist/types.d.ts`. This page keeps the parts this plugin relies on, with the exact names verified on SDK 2026.831.1.

## Package entry points

| Import | Use |
|---|---|
| `@paperclipai/plugin-sdk` | `definePlugin`, `runWorker`, manifest and context types |
| `@paperclipai/plugin-sdk/ui` | `usePluginData`, `usePluginAction`, `usePluginStream`, `useHostNavigation`, `useHostContext`, component kit |
| `@paperclipai/plugin-sdk/testing` | `createTestHarness` for in-process worker tests |
| `@paperclipai/plugin-sdk/bundlers` | `createPluginBundlerPresets` (esbuild and rollup presets for worker, manifest, ui) |

## Manifest (`src/manifest.ts`)

Fields this plugin declares: `id`, `apiVersion: 1`, `version`, `displayName`, `categories: ["ui"]`, `capabilities`, `entrypoints { worker, ui }`, `ui.slots`, `localFolders`, `instanceConfigSchema`, `jobs`, `database`.

- Slots: `page` (with `routePath`, mounts at `/:companyPrefix/<routePath>`), `sidebar`, `dashboardWidget`. Each slot names an `exportName` from `src/ui/index.tsx`.
- `instanceConfigSchema` is JSON Schema. A property with `"format": "secret-ref"` renders as a secret picker and stores `{ type: "secret_ref", secretId, version? }`. The host renders a company scoped form from it but does not prefill `default` values.
- `localFolders`: `{ folderKey, displayName, access: "read" | "readWrite", requiredDirectories, requiredFiles }`. Bound per company.
- `database: { namespaceSlug, migrationsDir }` plus `database.namespace.migrate|read|write` capabilities. Migrations are plain SQL files in that folder, run at install, schema qualified with the derived namespace name.
- `jobs: [{ jobKey, displayName, schedule }]` with 5 field cron; handler registered with `ctx.jobs.register`.

## Capabilities used

`local.folders`, `companies.read`, `projects.read`, `project.workspaces.read`, `issues.read`, `issue.comments.read`, `agents.read`, `http.outbound`, `secrets.read-ref`, `jobs.schedule`, `events.subscribe`, `plugin.state.read`, `plugin.state.write`, `database.namespace.migrate`, `database.namespace.read`, `database.namespace.write`, `activity.log.write`, `metrics.write`, `agent.tools.register`, `ui.page.register`, `ui.sidebar.register`, `ui.dashboardWidget.register`.

## Worker context (`ctx`)

| Service | Calls used here |
|---|---|
| `ctx.config.get(companyId)` | returns the saved config object or `null` |
| `ctx.localFolders.status(companyId, key)` / `.configure({companyId, folderKey, path})` | `realPath` is the cwd for git |
| `ctx.db.query(sql, params)` / `ctx.db.execute(sql, params)` / `ctx.db.namespace` | query for SELECT, execute for INSERT, UPDATE, DELETE inside the namespace |
| `ctx.entities.upsert({entityType, scopeKind, scopeId, externalId, title, status, data})` / `.list(query)` | one `git-branch` entity per branch |
| `ctx.state.get/set({scopeKind, scopeId, stateKey})` | small values only |
| `ctx.events.on(name, handler)` | run lifecycle events; payload shape is untyped, read defensively |
| `ctx.streams.open(channel, companyId)` / `.emit(channel, event)` | SSE to the UI when the host bridge is enabled |
| `ctx.jobs.register(jobKey, handler)` | job context has `jobKey`, `runId`, `trigger`, `scheduledAt`; no company, so iterate `ctx.companies.list()` |
| `ctx.issues.list({companyId, limit})` / `.listComments(issueId, companyId)` | ownership |
| `ctx.agents.list({companyId})` | names and status |
| `ctx.projects.list({companyId})` | workspace candidates |
| `ctx.secrets.resolve(ref, {companyId})` | GitHub token; never log or store the value |
| `ctx.activity.log({companyId, message, metadata})` | company feed |
| `ctx.metrics.write(name, value, tags)` | counters |
| `ctx.tools.register(name, {displayName, description, parametersSchema}, handler)` | agent callable tool |
| `ctx.data.register(key, handler)` / `ctx.actions.register(key, handler)` | what the UI calls; params arrive as the `params` object of the request body |
| `ctx.logger.info|warn|error(message, fields)` | lands in the host log; keep fields small |

Lifecycle hooks on `definePlugin`: `setup(ctx)`, `onHealth()`, `onConfigChanged(ctx)`, `onValidateConfig(config)`, `onShutdown()`.

## UI hooks

- `usePluginData<T>(key, params)` returns `{ data, loading, error, refresh }`; refetches when `params` changes, so always include `companyId`.
- `usePluginAction(key)` returns an async function taking params.
- `usePluginStream<T>(channel)` returns `{ events, connected, close }`; on hosts without the bridge it never connects, so fall back to polling.
- `useHostNavigation().linkProps(path)` builds a company prefixed link; `useHostContext()` gives `companyId` and `companyPrefix`.
- Slot props: `PluginPageProps`, `PluginSidebarProps`, `PluginWidgetProps`, each with `context.companyId`.

## Testing

`createTestHarness({ manifest, capabilities })` gives `harness.ctx` for `plugin.definition.setup`, then `harness.getData(key, params)`, `harness.performAction(key, params)`, `harness.emit(event, payload, meta)`, `harness.runJob(key)`, `harness.getState(scope)`. There is no fake database in the SDK; `tests/fake-db.ts` in this repo covers the SQL shapes the worker emits.

## Build

`esbuild.config.mjs` uses the SDK presets: worker (Node, ESM, externals kept), manifest, and UI (browser, React external, output `dist/ui/index.js`). `npm run dev` watches; the host reloads worker and UI on change, manifest changes need a reinstall.

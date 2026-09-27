# Paperclip, as this plugin sees it

[Paperclip](https://github.com/paperclipai/paperclip) runs a company of AI agents: an org chart, issues, budgets, a scheduler, and a plugin runtime. Each agent is a headless Claude Code (or other CLI) process the host spawns for a run. This plugin reads the git repository those agents push to and maps branches back to issues, agents, and pull requests.

## Where it lives on a dev machine

Paperclip is an npm package, not a checkout. A typical install:

```
<paperclip dir>/
  package.json                 depends on paperclipai
  node_modules/paperclipai/    the CLI: dist/index.js
  node_modules/@paperclipai/
    server/                    HTTP API and UI host (dist/routes/plugins.js has every plugin route)
    server/ui-dist/            the built web app; assets/index-*.css holds the theme tokens
    plugin-sdk/                what plugins import; README.md is the authoritative reference
    shared/                    types and constants shared by host and SDK
    db/                        Postgres schema and migrations
    adapter-*/                 agent runtimes (claude-local, codex-local, ...)
  launch-paperclip.ps1         starts the server and opens the app window (this repo's owner)
  paperclip-run.out.log        server log; plugin worker logs land here too
```

Server: `http://127.0.0.1:3100`, mode `local_trusted` (no auth). API under `/api`. The web app opens at the same origin; the in-app browser of the Claude desktop app only reaches it as `localhost`, not `127.0.0.1`.

## Objects the plugin touches

| Object | How the plugin uses it |
|---|---|
| Company | Everything is company scoped: config, local folder, cache rows, entities, events. Multiple companies can bind different repos. |
| Project and workspace | The welcome screen lists project workspaces that have a local path, so a bound repo is usually one click. |
| Issue | The branch name `agent/{ISSUE-KEY}-slug` resolves to an issue and its assignee. Issue comments are scanned for branch names as a fallback. |
| Agent | Owner of a branch; gives the hue used across the graph, the branch list, and the Agents tab. |
| Run events | `agent.run.started`, `agent.run.finished`, `agent.run.failed` trigger a debounced refs check and an activity event. |
| Activity log | Fetches, binds, and detected merges are logged so they appear in the company feed. |
| Metrics | `git_graph.open_prs`, `git_graph.branches`, `git_graph.commits_24h`. |

## CLI calls used in this repo

```
paperclipai plugin install <dir>            register a local plugin (runs migrations, starts the worker)
paperclipai plugin uninstall <key> --force  purge config and state; needed after manifest changes
paperclipai plugin disable|enable <key>     restart the worker without reinstalling
paperclipai plugin inspect|health|logs <key>
paperclipai plugin local-folder:set <key> repo -C <companyId> --payload-json '{"path":"..."}'
paperclipai plugin config:set <key> -C <companyId> --payload-json '{"configJson":{...}}'
```

The CLI binary is `node <paperclip dir>/node_modules/paperclipai/dist/index.js` when it is not on PATH; pass `--api-base http://127.0.0.1:3100`.

## HTTP routes the UI and tests use

```
POST /api/plugins/:idOrKey/data/:key        body {"companyId": C, "params": {...}}   -> {"data": ...}
POST /api/plugins/:idOrKey/actions/:key     same body shape
GET  /api/plugins/:idOrKey/config?companyId=C   null until saved once
POST /api/plugins/:idOrKey/config           body {"companyId": C, "configJson": {...}}
GET  /api/plugins/:idOrKey                  record with status, manifestJson, lastError
GET  /api/plugins/:idOrKey/bridge/stream/:channel?companyId=C   SSE; 501 on 2026.831.1
GET  /_plugins/:id/ui/index.js              the UI bundle the host loads into a slot
```

## Version notes

Built and tested against Paperclip 2026.831.1 and `@paperclipai/plugin-sdk` 2026.831.1. Quirks found on that build are listed in `CLAUDE.md` under "Host facts". Newer hosts may enable the stream bridge and prefill config defaults; both paths are handled.

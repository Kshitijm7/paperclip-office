# Contributing to Paperclip Office

Thanks for helping. Bug reports, layouts, themes, translations and features are all welcome.

## Setup

```bash
git clone https://github.com/<you>/paperclip-office.git
cd paperclip-office
npm ci
npm run build
npm run demo   # the real UI with a fictional company, no server needed
```

To try it in Paperclip, install the folder as a local plugin:

```bash
npx paperclipai plugin install "$(pwd)" --api-base http://127.0.0.1:3100
```

A rebuild reloads the plugin. A change to `src/manifest.ts` needs `plugin uninstall paperclip-office --force` and a fresh install.

## Before you open a pull request

- `npm run typecheck` and `npm test` pass.
- New logic has a test in `tests/`. Tests run against fixtures, never a live server.
- UI changes include a screenshot from `npm run demo`, not from a real company.
- Every new optional feature gets a setting in `src/shared/settings.ts` and `src/manifest.ts`, with a sensible default.

## House rules

1. **Never edit `vendor/`.** It is byte-identical to munder-difflin at the locked commit, and `scripts/sync-upstream.ps1 -Verify` checks it. Change behaviour through `src/adapters/`, or add a file override listed in `upstream/overrides.md` with the reason.
2. **Never commit LimeZu art.** Its licence forbids redistribution. Only CC0 or similarly open art goes in `assets/free/`, recorded in `assets/catalogue.json` and `NOTICE`.
3. **Stay deterministic.** Seed any randomness from company or agent ids. The same company must always get the same office.
4. **Match Paperclip.** Use the host CSS variables in `src/ui/tokens.ts`, not hard-coded colours, and Paperclip's names (agents, issues, runs, approvals).

## Where things live

| Path | What |
|---|---|
| `src/worker.ts`, `src/worker/` | Reads Paperclip through the SDK, builds the office snapshot, actions and agent tools |
| `src/shared/` | Pure logic: states, settings, cost, decisions. Most tests are here |
| `src/ui/` | React UI: page, Decision box, monitor, controls, widget |
| `src/layout/` | Floor plan generator, presets and art palettes. Read `docs/layouts.md` first |
| `src/adapters/`, `src/overrides/` | How the vendored scene runs against Paperclip data |
| `demo/` | Standalone demo with fixture data |

## Good first contributions

- A new layout preset in `src/layout/presets.ts`
- A chatter translation in `src/adapters/i18n.ts`
- Ideas from `docs/layouts.md` section 8: facing desk pods, a minimap, department nameplates, day and night lighting

## Reporting bugs

Open an issue with your Paperclip version, company size, theme and a screenshot. Please hide real agent and company names.

By contributing you agree your work is licensed under Apache-2.0.

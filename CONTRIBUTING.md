# Contributing

## Repository structure

```
fern-api/actions/
├── actions/
│   ├── setup-cli/          # Composite action — action.yml + README only
│   ├── sync-openapi/       # Node.js action — TypeScript, built to dist/
│   ├── fern-preview/       # Hybrid composite+Node.js — composite steps install CLI, then runs bundled JS
│   ├── generate/           # Node.js action — ALPHA
│   ├── upgrade/            # Node.js action — ALPHA
│   ├── verify/             # Node.js action — ALPHA
│   └── example-action/     # Template — not released
├── packages/
│   └── shared/             # Shared utilities, bundled into each Node.js action at build time
├── .github/workflows/
│   ├── ci.yml              # Runs on every push/PR: typecheck, lint, test, build verify
│   └── release.yml         # Runs on release publish: moves alias tags on this repo
└── biome.json              # Lint + format config (replaces ESLint + Prettier)
```

## Prerequisites

Install [devbox](https://www.jetify.com/devbox) for a reproducible environment (Node 20, pnpm 10):

```sh
devbox shell
```

Or manually ensure Node >= 20 and pnpm >= 9 are installed.

## Setup

```sh
pnpm install
```

This installs all workspace dependencies and sets up [lefthook](https://github.com/evilmartians/lefthook) pre-commit hooks.

## Development

```sh
pnpm typecheck       # TypeScript type checking across all packages
pnpm test            # Run all tests (vitest)
pnpm check           # Biome lint + format check
pnpm check:fix       # Auto-fix lint + format issues
pnpm build           # Build all Node.js actions (produces dist/index.js per action)
```

Pre-commit hooks run `pnpm check` and `pnpm typecheck` automatically on every commit.

## Adding a new action

### Node.js action

1. Copy `actions/example-action/` as a starting point.
2. Update `package.json` — set `name` to `@fern-github-actions/<your-action>`.
3. Update `action.yml` — set `runs.using: node20` and `runs.main: dist/index.js`.
4. Implement logic in `src/index.ts`; write tests in `tests/`.
5. Ensure `tsup.config.ts` keeps `noExternal: [/.*/]` — this bundles all deps into a single `dist/index.js` required for GitHub Actions runners.
6. Run `pnpm build` and commit the generated `dist/` (runners execute it directly, no install step).

### Composite action

1. Create `actions/<your-action>/action.yml` and `actions/<your-action>/README.md`.
2. No `package.json`, no `dist/` — composite actions run shell steps directly.

### Hybrid composite + Node.js action

Use this when you need composite steps (e.g. installing a CLI) **before** running Node.js logic.

1. Set `runs.using: composite` in `action.yml`.
2. Add composite steps for setup (e.g. `uses: fern-api/actions/setup-cli@...`).
3. Add a final step that runs `node ${{ github.action_path }}/dist/index.js`.
4. Structure the TypeScript source the same as a Node.js action (`src/`, `tsup.config.ts`, tests).
5. Commit `dist/` like a normal Node.js action — the composite step executes it directly.

`fern-preview` uses this pattern: composite steps install the Fern CLI, then a shell step runs the bundled JS that calls the CLI and posts PR comments.

## Releasing

All actions are referenced directly from `fern-api/actions` — consumers use `uses: fern-api/actions/<name>@<version>`. No mirroring to standalone repos.

### Tag format

```
<action-name>@<version>
```

Examples: `sync-openapi@v4.1.0`, `setup-cli@v1.2.0`

Each action is versioned independently.

### Release steps

```sh
# 1. Tag the commit
git tag sync-openapi@v4.1.0
git push origin sync-openapi@v4.1.0

# 2. Create the GitHub Release (triggers the release workflow)
gh release create sync-openapi@v4.1.0 --generate-notes
```

The [release workflow](.github/workflows/release.yml) then automatically moves the major and minor alias tags (e.g. `sync-openapi@v4`, `sync-openapi@v4.1`) on this repo so consumers pinned to a major version get the update immediately.

### Pre-release

Add the `--prerelease` flag:

```sh
gh release create sync-openapi@v4.1.0-beta.1 --generate-notes --prerelease
```

Alias tags (`v4`, `v4.1`) are not moved for pre-releases.

### Required secrets

The following secret must be set on this repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `ACTIONS_RELEASE_TOKEN` | GitHub PAT with `contents: write` on this repo for pushing version alias tags. |

## Action reference

| Action | Consumers use |
|---|---|
| `actions/sync-openapi` | `uses: fern-api/actions/sync-openapi@v4` |
| `actions/setup-cli` | `uses: fern-api/actions/setup-cli@v1` |
| `actions/fern-preview` | `uses: fern-api/actions/fern-preview@v1` |
| `actions/generate` | `uses: fern-api/actions/generate@v1` _(alpha)_ |
| `actions/upgrade` | `uses: fern-api/actions/upgrade@v1` _(alpha)_ |
| `actions/verify` | `uses: fern-api/actions/verify@v1` _(alpha)_ |
| `actions/example-action` | _(template only — not released)_ |

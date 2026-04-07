# Contributing

## Repository structure

```
fern-github-actions/
├── actions/
│   ├── setup-cli/          # Composite action — action.yml + README only
│   ├── sync-openapi/       # Node.js action — TypeScript, built to dist/
│   └── example-action/     # Template — not released or mirrored
├── packages/
│   └── shared/             # Shared utilities, bundled into each Node.js action at build time
├── .github/workflows/
│   ├── ci.yml              # Runs on every push/PR: typecheck, lint, test, build verify
│   └── release.yml         # Runs on release publish: mirrors action to standalone repo
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

### Register the action for releases

If the action will be published to its own standalone repo (see [Releasing](#releasing)):

1. Create `fern-api/<your-action>` on GitHub.
2. Add it to the `case` statement in `.github/workflows/release.yml` under the `parse` job:
   ```yaml
   your-action)
     MIRROR_REPO="fern-api/your-action"
     ;;
   ```
3. Add `ACTIONS_MIRROR_TOKEN` write access to the new repo (see [Required secrets](#required-secrets)).

## Releasing

All actions in this monorepo are referenced directly from `fern-api/actions` — no mirroring to standalone repos.

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

# 2. Create the GitHub Release (triggers the mirror workflow)
gh release create sync-openapi@v4.1.0 --generate-notes
```

The [release workflow](.github/workflows/release.yml) then automatically:

1. Parses the tag to identify the action and version.
2. For Node.js actions: builds a fresh `dist/index.js`.
3. Builds `dist/index.js` for Node.js actions.
4. Creates version tag and moves alias tags (`v4`, `v4.1`) on this repo.
5. Creates a GitHub Release on this repo.

### Pre-release

Add the `--prerelease` flag:

```sh
gh release create sync-openapi@v4.1.0-beta.1 --generate-notes --prerelease
```

The mirror release will also be marked as a pre-release. Alias tags (`v4`, `v4.1`) are not moved for pre-releases.

### Required secrets

The following secret must be set on this repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|---|---|
| `ACTIONS_MIRROR_TOKEN` | GitHub PAT with `contents: write` on this repo for pushing version alias tags. |

When adding a new mirrored action, grant `ACTIONS_MIRROR_TOKEN` write access to the new repo as well.

## Action reference

All actions are referenced directly from `fern-api/actions`:

| Action | Consumers use |
|---|---|
| `actions/sync-openapi` | `uses: fern-api/actions/sync-openapi@v4` |
| `actions/setup-cli` | `uses: fern-api/actions/setup-cli@v1` |
| `actions/generate` | `uses: fern-api/actions/generate@v1` |
| `actions/upgrade` | `uses: fern-api/actions/upgrade@v1` |
| `actions/verify` | `uses: fern-api/actions/verify@v1` |
| `actions/example-action` | _(template only — not released)_ |

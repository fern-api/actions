# Contributing

## Repository structure

```
fern-api/actions/
├── setup-cli/              # Node.js action — TypeScript, bundled to dist/index.js at release time
├── resolve-cli/            # Node.js action
├── verify-token/           # Node.js action
├── sync-openapi/           # Node.js action
├── preview/                # Node.js action — ALPHA
├── generate/               # Node.js action — ALPHA
├── upgrade/                # Node.js action — ALPHA
├── verify/                 # Node.js action — ALPHA
├── example-action/         # Template — not released
├── packages/
│   └── shared/             # Shared utilities, bundled into each action via tsup `noExternal`
├── scripts/
│   ├── build-env.ts        # Env map used by every tsup.config.ts for build-time substitution
│   └── append-release-entry.mjs  # Maintains <action>/RELEASES.md on main per release
├── .github/workflows/
│   ├── ci.yml              # Runs on every push/PR: typecheck, lint, test, build verify
│   └── release.yml         # workflow_dispatch — see "Releasing" below
└── biome.json              # Lint + format config (replaces ESLint + Prettier)
```

### Where bundles live

Source code lives on `main`. **Bundled `dist/index.js` files are not committed to `main`** — they're published per-release to per-action orphan branches (`dist/<action>`) by the release workflow. On a dist branch, `action.yml` and `dist/` live at the branch *root*, so consumers reference releases via `uses: fern-api/actions@<action>/<version>` (e.g. `uses: fern-api/actions@setup-cli/v1`). The slash-separated tag format and the flat dist layout exist together because GitHub Actions resolves `owner/repo/path@ref` by splitting on the last `@` — pinning to `owner/repo@<tag>` (no path) keeps the parse unambiguous and lets the tag namespace include the action name.

Local `pnpm build` still produces `dist/` directories — they're gitignored. You only need to run a build to typecheck the bundling step or to test a bundle locally.

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

This installs all workspace dependencies and sets up [lefthook](https://github.com/evilmartians/lefthook) pre-commit hooks (run `pnpm check` and `pnpm typecheck` on every commit).

## Development

```sh
pnpm typecheck       # TypeScript type checking across all packages
pnpm test            # Run all tests (vitest)
pnpm check           # Biome lint + format check
pnpm check:fix       # Auto-fix lint + format issues
pnpm build           # Build all Node.js actions (produces dist/ per action — gitignored)
```

## Adding a new action

1. Copy `example-action/` as a starting point.
2. Update `package.json` — set `name` to `@fern-github-actions/<your-action>`.
3. Update `action.yml` — set `runs.using: node20` and `runs.main: dist/index.js`.
4. Implement logic in `src/index.ts`; write tests in `tests/`.
5. Keep `tsup.config.ts` as the canonical shape — `noExternal: [/.*/]` (bundles all deps inline, required for GitHub Actions runners), `sourcemap: true`, and `env: getBuildEnv()` (build-time env injection for telemetry constants).
6. Run `pnpm build` to verify it bundles cleanly. **Do not commit `dist/`** — it's gitignored and gets published to the `dist/<your-action>` orphan branch the first time you run the release workflow against this action.
7. Add the new action to the workflow_dispatch `action` choice list in `.github/workflows/release.yml`.

Wire the telemetry wrapper from inside `src/index.ts` (see existing actions for the pattern):

```ts
runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();
  await instrumentAction("<your-action>", async () => {
    // parse inputs, do work
  });
});
```

## Releasing

All actions are versioned independently. Tags are immutable and follow `<action-name>/<version>`, e.g. `sync-openapi/v4.1.0`. Floating major/minor aliases (`sync-openapi/v4`, `sync-openapi/v4.1`) are moved automatically. The slash separator (rather than `@`) is what keeps `uses: fern-api/actions@sync-openapi/v4.1.0` parseable — see [Where bundles live](#where-bundles-live) above.

### How to release

Releases happen via the [`release.yml`](.github/workflows/release.yml) workflow's `workflow_dispatch` trigger:

```sh
gh workflow run release.yml \
  -f action=sync-openapi \
  -f version=v4.1.0
```

Or from the UI: **Actions → Release Action → Run workflow**, pick the action, type the version (with `v` prefix), optionally tick "prerelease".

### What the workflow does

1. **validate** — semver-checks the version, rejects `example-action`, hard-fails if the tag already exists
2. **build** — installs deps, builds shared + the selected action with `RELEASE_TAG`, `POSTHOG_API_KEY`, `SENTRY_DSN_AUTOMATIONS`, `AUTOMATION_EVENT_API_URL` baked into the bundle via tsup's `env` map. Asserts the substitution actually happened
3. **sentry-release** — creates a Sentry release named `<action>@<version>` (note: `@` not `/` — Sentry rejects slashes in release identifiers) and uploads sourcemaps. The Sentry release id matches the `RELEASE_TAG` baked into the bundle so source-map deobfuscation resolves. Auto-skips if `FERN_SENTRY_AUTH_TOKEN` is not provisioned
4. **publish-dist** — checks out (or orphan-creates) `dist/<action>`, wipes the working tree, copies in the freshly built `dist/` and `action.yml` *at the branch root*, commits with `Source:` / `Built from:` lines referencing the source SHA, pushes, then tags `<action>/<version>` on that commit
5. **alias-tags** — force-moves `<action>/v<major>` and `<action>/v<major>.<minor>` aliases (skipped on prerelease)
6. **github-release** — `gh release create <action>/<version> --generate-notes`
7. **main-release-marker** — prepends an entry to `<action>/RELEASES.md` on main via `scripts/append-release-entry.mjs` and pushes a `chore(release): <action>/<version>` commit. Best-effort: a failed push (e.g. branch protection) logs a warning but does not roll back the release

### Prereleases

Set `prerelease: true`. Examples of valid prerelease versions: `v4.1.0-beta.1`, `v4.1.0-rc.2`. The floating major/minor aliases are not moved.

### Backward compatibility note

Old tags (if any) point at historical commits on `main` from before this workflow existed — those still work because they reference commits that had `dist/` committed and were consumed via `fern-api/actions/<action>@<ref>`. Going forward, tags use the new slash-separated format (`<action>/<version>`) and consumers reference them via the no-path form: `fern-api/actions@<action>/<version>`. The two short-lived prerelease tags created with the old `<action>@<version>` format (`verify-token@v0.0.1-test`, `preview@v0.0.1-ci-test`) are kept in place but are unconsumable via the standard `uses:` parser — see PR #15803 discussion.

### Required configuration

All telemetry-related values live as **secrets** at **Settings → Secrets and variables → Actions → Secrets**:

| Name | Description |
|---|---|
| `FERN_SENTRY_AUTH_TOKEN` | Sentry user/org token with `project:releases` scope. Same secret as the fern repo so a single token covers all release pipelines. Without it, the `sentry-release` job auto-skips. |
| `POSTHOG_API_KEY` | PostHog project key. Empty = PostHog stays no-op. |
| `SENTRY_DSN_AUTOMATIONS` | Sentry DSN baked into the bundle for runtime event capture. Empty = capture stays no-op. |
| `AUTOMATION_EVENT_API_URL` | Fern Lightweight API base URL. Empty = stays no-op. |

Note: PostHog project keys and Sentry DSNs are technically write-only at the project level and *could* be repo vars, but we keep them as secrets for light-touch obfuscation in CI logs.

`SENTRY_ORG` (`buildwithfern`) and `SENTRY_PROJECT` (`automations-actions`) are hardcoded in [release.yml](.github/workflows/release.yml) — no configuration needed.

The default `GITHUB_TOKEN` (`contents: write` from the workflow's own permissions block) handles tag pushes, dist branch pushes, GitHub Release creation, and the marker commit on main.

## Action reference

| Action | Consumers use |
|---|---|
| `sync-openapi` | `uses: fern-api/actions@sync-openapi/v4` |
| `setup-cli` | `uses: fern-api/actions@setup-cli/v1` |
| `resolve-cli` | `uses: fern-api/actions@resolve-cli/v1` |
| `verify-token` | `uses: fern-api/actions@verify-token/v1` |
| `preview` | `uses: fern-api/actions@preview/v1` _(alpha)_ |
| `generate` | `uses: fern-api/actions@generate/v1` _(alpha)_ |
| `upgrade` | `uses: fern-api/actions@upgrade/v1` _(alpha)_ |
| `verify` | `uses: fern-api/actions@verify/v1` _(alpha)_ |
| `example-action` | _(template only — not released)_ |

To pin to the unreleased tip of `main` (no version stability) you can still use the source-tree layout: `uses: fern-api/actions/<action>@main`. That form keeps working because `main` has no `@` in its name, so the standard `owner/repo/path@ref` parse resolves cleanly.

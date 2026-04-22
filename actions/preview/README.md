# preview

A GitHub Action that publishes preview SDK packages and posts PR comments with install links and SDK diffs.

## What it does

1. **Calls** `fern automations preview --json` — the CLI discovers all eligible TypeScript generator groups and runs SDK preview for each one
2. **Posts** a PR comment with install commands and diff links

All heavy lifting (group detection, npm publishing, diff branch pushing to SDK repos) happens in the Fern CLI and Fiddle, matching how `fern generate` works. No Docker or cross-repo GitHub tokens needed on the runner.

## Usage

```yaml
name: Fern SDK Preview
on:
  pull_request:
    paths:
      - "fern/**"

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fern-api/actions/preview@v1
        with:
          fern-token: ${{ secrets.FERN_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `fern-token` | Yes | — | Fern authentication token (`FERN_TOKEN`) |
| `fern-version` | No | `auto` | Fern CLI version to install. `auto` installs the latest release; the CLI self-redirects to the version pinned in `fern.config.json` at runtime. |

## PR Comment

The action posts (or updates) a single comment on the PR. Each group gets its own section with a diff link and install command:

```
## SDK Preview

### ts-sdk
[Preview changes](https://...)

```sh
npm install @acme/sdk@npm:@acme-preview/sdk@0.0.1 --registry https://npm.buildwithfern.com
```
```

For multiple groups, each group appears as a separate section. A collapsible AI prompt section is included with all install commands for easy copy-paste into AI assistants.

## Requirements

- A `fern/` directory with `generators.yml` containing TypeScript SDK generators
- A valid `FERN_TOKEN` secret
- The [Fern GitHub App](https://github.com/apps/fern-api) installed on your SDK repos (for diff branches)

## Supported Generators

- `fern-typescript-sdk`
- `fern-typescript-node-sdk`
- `fern-typescript-browser-sdk`

(With or without the `fernapi/` prefix)

## Architecture

The action is a thin wrapper around the Fern CLI:

1. **setup-cli** installs the Fern CLI at the requested version
2. **`fern automations preview --json --push-diff`** handles both group detection and SDK preview execution
3. The action parses the aggregated JSON results and posts a PR comment

Group detection (which generators are previewable) and preview execution are owned by the CLI, so the action doesn't need to parse `generators.yml` or know about generator types.

## Notes

- **Server-side generation**: Preview generation runs through Fiddle (Fern's cloud infrastructure), which handles npm publishing and diff branch pushing. This matches how `fern generate` works.
- **Branch cleanup**: Fiddle creates `fern-preview-{jobVersion}` branches in SDK repos for diff comparisons. Consider a periodic cleanup job to delete stale `fern-preview-*` branches.
- **GitHub authentication**: Fiddle uses the Fern GitHub App to push diff branches to SDK repos server-side — no personal access tokens or cross-repo GitHub tokens required from users.

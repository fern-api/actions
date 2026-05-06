# upgrade

**[ALPHA]** Upgrades Fern CLI and generator versions and opens or updates a shared upgrade PR.

Runs `fern automations upgrade --json` under the hood, which wraps both
`fern upgrade` (CLI bump) and `fern generator upgrade` (generator bumps) into a
single call with structured JSON output. The action then creates or updates a PR
on the `fern/upgrade` branch with a changelog table.

> **Minimum CLI version:** Requires `fern-api@5.7.3` or later (the first release
> with `fern automations upgrade`).

## Usage

```yaml
name: Fern Upgrade
on:
  schedule:
    - cron: "0 9 * * 1" # every Monday at 9am
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  upgrade:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fern-api/actions/upgrade@main
        with:
          fern-token: ${{ secrets.FERN_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `version` | No | `latest` | Fern CLI version to use. `latest` always uses the newest release, `auto` respects `fern.config.json` and falls back to latest, or pin to a specific version (e.g. `5.7.3`). |
| `fern-token` | **Yes** | — | Fern token for API access and CLI authentication. |
| `include-major` | No | `true` | Whether to include major version upgrades for generators. Both the CLI and GHA default to `true` — the automations upgrade command is designed to aggressively upgrade, letting the preview action validate breaking changes. Set to `false` for minor/patch only. |
| `github-token` | No | `${{ github.token }}` | GitHub token for PR creation and push access. |

## Outputs

| Output | Description |
|--------|-------------|
| `run-id` | UUIDv4 for this upgrade run |
| `pr-url` | URL of the created or updated upgrade PR (empty if no changes) |
| `cli-upgraded` | Whether the Fern CLI version was upgraded (`true`/`false`) |
| `generators-upgraded` | JSON array of `{generator, from, to}` for each upgraded generator |

## How it works

1. Resolves the Fern CLI binary based on the `version` input.
2. Runs `fern automations upgrade --json [--no-include-major]` which:
   - Upgrades the CLI version in `fern.config.json`
   - Upgrades all generator versions in `generators.yml`
   - Outputs structured JSON with before/after versions
3. Builds a PR title, body (with changelog table), and commit message from the JSON.
4. Pushes changes to the `fern/upgrade` branch and creates or updates a PR.

## CLI flag mapping

| GHA Input | CLI Flag | CLI Default | GHA Default |
|-----------|----------|-------------|-------------|
| `version` | Controls which CLI binary runs | — | `latest` |
| `include-major` | `--include-major` / `--no-include-major` | `true` | `true` |
| `fern-token` | `FERN_TOKEN` env var | — | — |

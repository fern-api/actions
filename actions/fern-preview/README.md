# fern-preview

A GitHub Action that publishes preview SDK packages and posts PR comments with install links and SDK diffs.

## What it does

1. **Detects** all TypeScript generator groups in your `fern/` directory
2. **Runs** `fern sdk preview` for each group — routes through Fiddle for remote generation
3. **Posts** a PR comment with install commands and diff links

All heavy lifting (npm publishing, diff branch pushing to SDK repos) happens server-side in Fiddle, matching how `fern generate` works. No Docker or cross-repo GitHub tokens needed on the runner.

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
      - uses: fern-api/fern-preview@v1
        with:
          fern-token: ${{ secrets.FERN_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `fern-token` | Yes | — | Fern authentication token (`FERN_TOKEN`) |
| `fern-version` | No | `latest` | Fern CLI version to install |

## PR Comment

The action posts (or updates) a single comment on the PR:

| Group | Package | Install | SDK Diff |
|-------|---------|---------|----------|
| ts-sdk | @acme-preview/sdk | `npm install ...` | [View diff](...) |

## Requirements

- A `fern/` directory with `generators.yml` containing TypeScript SDK generators
- A valid `FERN_TOKEN` secret
- The [Fern GitHub App](https://github.com/apps/fern-api) installed on your SDK repos (for diff branches)

## Supported Generators

- `fern-typescript-sdk`
- `fern-typescript-node-sdk`
- `fern-typescript-browser-sdk`

(With or without the `fernapi/` prefix)

## Notes

- **Server-side generation**: Preview generation runs through Fiddle (Fern's cloud infrastructure), which handles npm publishing and diff branch pushing. This matches how `fern generate` works.
- **Branch cleanup**: Fiddle creates `fern-preview-{jobVersion}` branches in SDK repos for diff comparisons. Consider a periodic cleanup job to delete stale `fern-preview-*` branches.
- **GitHub authentication**: Fiddle uses the Fern GitHub App to push diff branches to SDK repos server-side — no personal access tokens or cross-repo GitHub tokens required from users.

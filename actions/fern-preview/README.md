# fern-preview

A GitHub Action that publishes preview SDK packages and posts PR comments with install links and SDK diffs.

## What it does

1. **Detects** all TypeScript generator groups in your `fern/` directory
2. **Publishes** preview packages to the Fern preview registry (`npm.buildwithfern.com`)
3. **Pushes** a diff branch to each target SDK repo showing what would change
4. **Posts** a PR comment with install commands and diff links

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
| `github-token` | No | `${{ github.token }}` | GitHub token with push access to SDK repos |
| `fern-version` | No | `latest` | Fern CLI version to install |

## PR Comment

The action posts (or updates) a single comment on the PR:

| Group | Package | Install | SDK Diff |
|-------|---------|---------|----------|
| ts-sdk | @acme-preview/sdk | `npm install ...` | [View diff](...) |

## Requirements

- A `fern/` directory with `generators.yml` containing TypeScript SDK generators
- A valid `FERN_TOKEN` secret
- Docker available on the runner (default GitHub-hosted runners include Docker)
- Fern CLI **4.63.0+** (the `--output` flag used by this action was added in 4.63.0)

## Supported Generators

- `fern-typescript-sdk`
- `fern-typescript-node-sdk`
- `fern-typescript-browser-sdk`

(With or without the `fernapi/` prefix)

## Notes

- **Branch cleanup**: The action creates `fern-preview-pr-<N>` branches in SDK repos for diff comparisons. These branches accumulate after PRs merge or close. Consider adding a `pull_request: closed` workflow step or a periodic cleanup job to delete stale `fern-preview-pr-*` branches.
- **Same-owner restriction**: For security, diff branches are only pushed to SDK repos owned by the same GitHub organization as the source repository. Cross-org SDK repos will be skipped with a warning.

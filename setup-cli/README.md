<br/>
<div align="center">
  <a href="https://www.buildwithfern.com/?utm_source=github&utm_medium=readme&utm_campaign=setup-cli&utm_content=logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fern-api/fern/main/fern/images/logo-white.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/fern-api/fern/main/fern/images/logo-primary.svg">
      <img alt="logo" src="https://raw.githubusercontent.com/fern-api/fern/main/fern/images/logo-primary.svg" height="80" align="center">
    </picture>
  </a>
<br/>

<br/>

[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Setup%20Fern%20CLI-blue?logo=github)](https://github.com/marketplace/actions/setup-cli)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)
[![Documentation](https://img.shields.io/badge/Read%20our%20Documentation-black?logo=book)](https://buildwithfern.com/learn/home?utm_source=fern-api/actions/setup-cli/readme-read-our-documentation)

</div>

# 🌿 setup-cli

A GitHub Action that installs the [Fern CLI](https://github.com/fern-api/fern) in your workflow — so you can generate SDKs and docs on every push.

## Requirements

Node.js and npm must be available before this action runs. Add [`actions/setup-node`](https://github.com/actions/setup-node) as a prior step if your runner doesn't include them by default.

## Usage

Pin to the floating major version (e.g. `@setup-cli/v1`) to automatically receive the latest updates:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "lts/*"

- name: Setup Fern CLI
  uses: fern-api/actions@setup-cli/v1
```

### With a specific version

```yaml
- name: Setup Fern CLI
  uses: fern-api/actions@setup-cli/v1
  with:
    version: "3.81.0"
```

## Inputs

| Input     | Description                                      | Default  |
| --------- | ------------------------------------------------ | -------- |
| `version` | Fern CLI version to install (`latest` or semver) | `latest` |

## Example workflow

```yaml
name: Generate SDKs

on:
  push:
    branches: [main]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "lts/*"

      - name: Setup Fern CLI
        uses: fern-api/actions@setup-cli/v1

      - run: fern generate
```

## Releasing

Dispatch [`.github/workflows/release.yml`](https://github.com/fern-api/actions/actions/workflows/release.yml) in the [fern-api/actions](https://github.com/fern-api/actions) monorepo (`action: setup-cli`, `version: v1.0.1`). The workflow builds the bundle, publishes it to the root of `dist/setup-cli`, creates the tag `setup-cli/v1.0.1`, and moves the floating `setup-cli/v1` major alias so consumers pinned to `@setup-cli/v1` get the update immediately. See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

---

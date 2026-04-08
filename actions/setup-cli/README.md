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

Use the major version tag (e.g. `@v1`) to automatically receive the latest updates:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "lts/*"

- name: Setup Fern CLI
  uses: fern-api/actions/setup-cli@v1
```

### With a specific version

```yaml
- name: Setup Fern CLI
  uses: fern-api/actions/setup-cli@v1
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
        uses: fern-api/actions/setup-cli@v1

      - run: fern generate
```

## Releasing

Tag the commit and publish a GitHub Release from the [fern-api/actions](https://github.com/fern-api/actions) monorepo:

```sh
git tag setup-cli@v1.0.1
git push origin setup-cli@v1.0.1
gh release create setup-cli@v1.0.1 --generate-notes
```

The release workflow moves the major version tag (e.g. `v1`) so users pinned to `@v1` get the update immediately.

---

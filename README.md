<br/>
<div align="center">
  <a href="https://www.buildwithfern.com/?utm_source=github&utm_medium=readme&utm_campaign=actions&utm_content=logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/fern-api/fern/main/fern/images/logo-white.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/fern-api/fern/main/fern/images/logo-primary.svg">
      <img alt="Fern" src="https://raw.githubusercontent.com/fern-api/fern/main/fern/images/logo-primary.svg" height="80" align="center">
    </picture>
  </a>
<br/>

<br/>

![License](https://img.shields.io/badge/license-Apache%202.0-blue)
[![Documentation](https://img.shields.io/badge/Read%20our%20Documentation-black?logo=book)](https://buildwithfern.com/learn/home)

</div>

# Fern GitHub Actions

A monorepo of GitHub Actions for automating SDK generation, publishing, and API spec management with [Fern](https://github.com/fern-api/fern).

All actions are referenced directly from this repo — no separate installs needed:

```yaml
uses: fern-api/actions/<action-name>@<version>
```

## Actions

### [`setup-cli`](actions/setup-cli/README.md)

Install the Fern CLI in your workflow.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "lts/*"
- uses: fern-api/actions/setup-cli@v1
```

---

### [`sync-openapi`](actions/sync-openapi/README.md)

Keep your Fern config up to date — pull OpenAPI specs from a public URL or sync files between repositories, and open a PR with the changes.

```yaml
- uses: fern-api/actions/sync-openapi@v4
  with:
    token: ${{ secrets.OPENAPI_SYNC_TOKEN }}
    update_from_source: true
```

---

### [`generate`](actions/generate/action.yml) _(alpha)_

Run `fern generate` on push to `main` and open SDK PRs in SDK repos. Includes breaking change detection and failure issue management.

```yaml
- uses: fern-api/actions/generate@v1
  with:
    fern-token: ${{ secrets.FERN_TOKEN }}
```

---

### [`upgrade`](actions/upgrade/action.yml) _(alpha)_

Upgrade Fern CLI and generator versions on a schedule and open or update a single shared PR.

```yaml
- uses: fern-api/actions/upgrade@v1
  with:
    fern-token: ${{ secrets.FERN_TOKEN }}
```

---

### [`verify`](actions/verify/action.yml) _(alpha)_

Validate Fern changes on PRs before merge — runs generation, self-verification, and breaking change detection. Enables automerge on clean PRs, requests reviewers on failures.

```yaml
- uses: fern-api/actions/verify@v1
  with:
    fern-token: ${{ secrets.FERN_TOKEN }}
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, how to add a new action, and the release process.

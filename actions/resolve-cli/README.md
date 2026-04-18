# resolve-cli

A shared composite action that resolves the Fern CLI command based on a requested version. Used internally by other Fern actions to centralize CLI version resolution logic.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `version` | `auto` respects `fern.config.json`, `latest` uses the newest release, `inherit` uses whatever CLI is on PATH, or a specific version/npm tag (e.g. `0.15.0`, `beta`). | `auto` |

## Outputs

| Output | Description |
|--------|-------------|
| `fern-cmd` | The resolved command to invoke the Fern CLI (e.g. `npx --yes fern-api@latest` or `fern`). |

## Usage

```yaml
steps:
  - uses: fern-api/actions/resolve-cli@main
    id: cli
    with:
      version: "latest"

  - run: ${{ steps.cli.outputs.fern-cmd }} generate
```

## Version resolution

| `version` value | Behavior |
|-----------------|----------|
| `auto` | Installs latest via `npx`, lets the CLI resolve from `fern.config.json` at runtime. |
| `latest` | Installs latest via `npx` with `FERN_NO_VERSION_REDIRECTION=true`. |
| `inherit` | Uses bare `fern` from PATH with `FERN_NO_VERSION_REDIRECTION=true`. Fails if `fern` is not found. |
| `0.15.0` / `beta` / any tag | Installs that version via `npx` with `FERN_NO_VERSION_REDIRECTION=true`. |

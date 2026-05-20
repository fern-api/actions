# verify-token dist branch

Holds published `verify-token` artifacts at the branch root. Each commit
corresponds to a release; tags `verify-token/vX.Y.Z` point at specific
commits here. Consume via:

```yaml
uses: fern-api/actions@verify-token/vX.Y.Z
```

Source code lives on `main`. **Do not edit this branch by hand** — the
[release workflow](https://github.com/fern-api/actions/actions/workflows/release.yml)
manages it.

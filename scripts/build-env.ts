/**
 * Build-time env values baked into action bundles by tsup's `env` option.
 *
 * Each constant in `packages/shared/src/telemetry/build-constants.ts` reads
 * from `process.env.X ?? <fallback>`; tsup substitutes those reads with
 * string literals at bundle time using this map.
 *
 * Local dev / tests / non-release CI: env vars unset, all values empty —
 * telemetry no-ops because the SDK initializers short-circuit on empty
 * keys.
 *
 * Release CI (.github/workflows/release.yml): env vars populated
 * from repo vars/secrets, values get baked into the dist bundle.
 *
 * Imported by every action's `tsup.config.ts` and by
 * `packages/shared/tsup.config.ts` so the same env map applies whether
 * shared is built standalone (typecheck/test) or re-bundled into an
 * action via `noExternal`.
 */
export function getBuildEnv(): Record<string, string> {
  return {
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY ?? "",
    SENTRY_DSN_AUTOMATIONS: process.env.SENTRY_DSN_AUTOMATIONS ?? "",
    AUTOMATION_EVENT_API_URL: process.env.AUTOMATION_EVENT_API_URL ?? "",
    RELEASE_TAG: process.env.RELEASE_TAG ?? "dev",
  };
}

/**
 * Telemetry constants. PostHog project API keys and Sentry DSNs are designed
 * to be embedded in client code:
 *   - https://posthog.com/docs/api#how-to-get-your-api-key (project keys are
 *     write-only at the project level — safe to commit).
 *   - https://docs.sentry.io/product/sentry-basics/dsn-explainer/ (DSNs are
 *     not secrets — same pattern as every Sentry-instrumented mobile app).
 *
 * Both are rate-limited and write-only; leaking them buys an attacker the
 * ability to send junk events, not the ability to read.
 *
 * Values are baked in at bundle time via tsup's `env` option (see
 * `tsup.config.ts` in each action and `packages/shared/tsup.config.ts`).
 * Empty strings are the no-op signal — the SDKs short-circuit when their
 * constant is empty, so unconfigured local dev / non-release builds ship
 * a working bundle that simply doesn't emit telemetry.
 */
export const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY ?? "";
export const POSTHOG_HOST = "https://us.i.posthog.com";
export const SENTRY_DSN_AUTOMATIONS = process.env.SENTRY_DSN_AUTOMATIONS ?? "";
export const AUTOMATION_EVENT_API_URL = process.env.AUTOMATION_EVENT_API_URL ?? "";

/**
 * Release identifier baked into the bundle at build time. Format:
 * `<action>@<version>` (e.g. `setup-cli@v4.1.0`). Used as Sentry `release`
 * tag, PostHog `$lib_version`, and the event payload's `actions_version`
 * field — all three should match so Sentry source-map upload, PostHog
 * version filters, and downstream analytics resolve to the same release.
 *
 * Defaults to `"dev"` for local dev, tests, and non-release CI builds —
 * those events never reach prod sinks because the API keys are empty in
 * those builds anyway.
 */
export const RELEASE_TAG = process.env.RELEASE_TAG ?? "dev";

/**
 * True when running on a GitHub Actions runner. Used by the PostHog and
 * Sentry SDK initializers to short-circuit local-dev runs so they don't
 * pollute prod telemetry.
 */
export function isGithubActionsRunner(): boolean {
  return process.env.GITHUB_ACTIONS === "true";
}

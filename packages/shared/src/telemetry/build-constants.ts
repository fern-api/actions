/**
 * Hardcoded telemetry constants. PostHog project API keys and Sentry DSNs are
 * designed to be embedded in client code:
 *   - https://posthog.com/docs/api#how-to-get-your-api-key (project keys are
 *     write-only at the project level — safe to commit).
 *   - https://docs.sentry.io/product/sentry-basics/dsn-explainer/ (DSNs are
 *     not secrets — same pattern as every Sentry-instrumented mobile app).
 *
 * Both are rate-limited and write-only; leaking them buys an attacker the
 * ability to send junk events, not the ability to read.
 *
 * Empty strings until provisioning lands. The SDKs initialize as no-ops when
 * their constant is empty, so the wrapper ships safely before the
 * `automations` Sentry project and the Automation Event API endpoint come
 * online.
 */
export const POSTHOG_API_KEY = "";
export const POSTHOG_HOST = "https://us.i.posthog.com";
export const SENTRY_DSN_AUTOMATIONS = "";
export const AUTOMATION_EVENT_API_URL = "";

/**
 * True when running on a GitHub Actions runner. Used by the PostHog and
 * Sentry SDK initializers to short-circuit local-dev runs so they don't
 * pollute prod telemetry.
 */
export function isGithubActionsRunner(): boolean {
  return process.env.GITHUB_ACTIONS === "true";
}

// NOTE: a build identifier (release tag or git SHA) intentionally isn't
// emitted today. Once releases are built in CI, Sentry releases, PostHog
// `$lib_version`, and the event payload's `actions_version` field should all
// be populated together with the actual release tag (and Sentry source-maps
// upload should key off the same tag).

import * as core from "@actions/core";

/**
 * Returns the current FERN_RUN_ID if already set by an earlier step in the
 * same workflow (e.g. setup-cli), otherwise generates a new UUIDv4, exports
 * it as FERN_RUN_ID so downstream steps inherit it, and returns it.
 *
 * GITHUB_RUN_ID is always captured separately for cross-referencing in
 * telemetry and Sentry — it is not a substitute for FERN_RUN_ID since it
 * is not a UUID and is not unique across repos or retries.
 */
export function getOrCreateRunId(): string {
  const existing = process.env.FERN_RUN_ID;
  if (existing) {
    core.debug(`Inheriting FERN_RUN_ID from environment: ${existing}`);
    return existing;
  }
  const runId = crypto.randomUUID();
  core.exportVariable("FERN_RUN_ID", runId);
  core.debug(`Generated new FERN_RUN_ID: ${runId}`);
  return runId;
}

/**
 * Returns the GITHUB_RUN_ID for cross-referencing with FERN_RUN_ID in
 * telemetry events and Sentry tags.
 */
export function getGithubRunId(): string {
  return process.env.GITHUB_RUN_ID ?? "";
}

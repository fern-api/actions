import * as core from "@actions/core";
import { PostHog } from "posthog-node";
import {
  POSTHOG_API_KEY,
  POSTHOG_HOST,
  RELEASE_TAG,
  isGithubActionsRunner,
} from "./build-constants.js";
import type { TelemetryContext, TelemetryEvent } from "./types.js";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client !== null) {
    return client;
  }
  if (!isGithubActionsRunner() || !POSTHOG_API_KEY) {
    return null;
  }
  client = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/**
 * Captures a telemetry event in PostHog. Common fields and the
 * event's `attributes` are flattened side-by-side as PostHog properties so
 * filters can use `status`, `cause`, `error_code` directly without nested
 * property syntax. No-op when the API key isn't baked or when running
 * locally.
 */
export function capturePostHogEvent(event: TelemetryEvent, context: TelemetryContext): void {
  const client = getClient();
  if (!client) {
    return;
  }
  try {
    client.capture({
      distinctId: context.runId,
      event: event.event,
      properties: {
        $lib: "fern-actions",
        $lib_version: RELEASE_TAG,
        actions_version: RELEASE_TAG,
        surface: "actions",
        action: context.action,
        run_id: context.runId,
        github_run_id: context.githubRunId,
        github_run_url: context.githubRunUrl,
        org: context.org,
        config_repo: context.configRepo,
        config_commit_sha: context.configCommitSha,
        config_branch: context.configBranch,
        config_pr_number: context.configPrNumber,
        trigger: context.trigger,
        cli_version: context.cliVersion,
        ...(event.errorCode !== undefined ? { error_code: event.errorCode } : {}),
        ...(event.attributes ?? {}),
      },
    });
  } catch (err) {
    core.warning(`PostHog capture failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function shutdownPostHog(): Promise<void> {
  if (client === null) {
    return;
  }
  try {
    await client.shutdown();
  } catch (err) {
    core.warning(`PostHog shutdown failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    client = null;
  }
}

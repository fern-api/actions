import * as core from "@actions/core";
import * as Sentry from "@sentry/node";
import { SENTRY_DSN_AUTOMATIONS, isGithubActionsRunner } from "./build-constants.js";
import { EventName, type TelemetryContext, type TelemetryEvent } from "./types.js";

let initialized = false;

function ensureInit(): boolean {
  if (initialized) {
    return true;
  }
  if (!isGithubActionsRunner() || SENTRY_DSN_AUTOMATIONS.length === 0) {
    return false;
  }
  Sentry.init({
    dsn: SENTRY_DSN_AUTOMATIONS,
    environment: process.env.GITHUB_REF_NAME ?? "unknown",
    defaultIntegrations: false,
  });
  initialized = true;
  return true;
}

/**
 * Captures a telemetry event in Sentry. Real-exception causes attach
 * a stack trace via `captureException`; the `cli_unobserved_exit` cause has
 * no JS exception, so it captures a sentinel message instead.
 *
 * No-op when the DSN isn't baked or when running locally.
 */
export function captureSentryEvent(
  event: TelemetryEvent,
  context: TelemetryContext,
  originalError: unknown
): void {
  if (!ensureInit()) {
    return;
  }
  const attributes = event.attributes ?? {};
  try {
    Sentry.withScope((scope) => {
      scope.setTags({
        surface: "actions",
        automation_mode: "true",
        event: EventName.WrapperFailed,
        action: context.action,
        run_id: context.runId,
        org: context.org,
        config_repo: context.configRepo,
        trigger: context.trigger,
        error_code: event.errorCode ?? "none",
      });
      scope.setContext("automation", {
        github_run_url: context.githubRunUrl,
        config_commit_sha: context.configCommitSha,
        config_branch: context.configBranch,
        config_pr_number: context.configPrNumber,
        cli_version: context.cliVersion,
        github_run_id: context.githubRunId,
        ...attributes,
      });

      if (originalError instanceof Error) {
        Sentry.captureException(originalError);
      } else {
        const message = attributes.error_message;
        Sentry.captureMessage(
          typeof message === "string" ? message : EventName.WrapperFailed,
          "error"
        );
      }
    });
  } catch (err) {
    core.warning(`Sentry capture failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function shutdownSentry(): Promise<void> {
  if (!initialized) {
    return;
  }
  try {
    await Sentry.close(2000);
  } catch (err) {
    core.warning(`Sentry shutdown failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    initialized = false;
  }
}

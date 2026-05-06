import * as core from "@actions/core";
import { AUTOMATION_EVENT_API_URL, isGithubActionsRunner } from "./build-constants.js";
import type { TelemetryContext, TelemetryEvent } from "./types.js";

const TIMEOUT_MS = 5000;

/**
 * Module-level mutable state for the Fern Automations Automation Event API
 * client. The wrapper runs in a single Node process per action, so a
 * module-level singleton is the right shape — there's no multi-tenant
 * concern, just one run's worth of token + in-flight requests.
 */
let fernToken: string | null = null;
let inflight: Promise<unknown>[] = [];

/**
 * Configures the `Authorization: Bearer ...` token used on every POST.
 * Called once from inside `instrumentAction`'s body, after input parsing,
 * so input-parsing failures still get classified before the token is
 * available.
 */
export function injectFernToken(token: string): void {
  fernToken = token.length > 0 ? token : null;
}

/**
 * POSTs a telemetry event to the Automation Event API (`/v1/automation/events`).
 * The function itself is event-agnostic — the decision of which events
 * flow through this sink is made by callers (`captureFernAutomationsEvent`
 * only enqueues `wrapper_failed`; run-level events stay PostHog-only).
 * The endpoint may not exist yet; 404s and network errors are swallowed
 * with a `core.warning` so wrapper-side observability never breaks.
 * PostHog and Sentry remain authoritative.
 *
 * No-op when running locally or when the URL constant is empty.
 */
async function postAutomationEvent(
  event: TelemetryEvent,
  context: TelemetryContext
): Promise<void> {
  if (!isGithubActionsRunner() || AUTOMATION_EVENT_API_URL.length === 0) {
    return;
  }
  const url = `${AUTOMATION_EVENT_API_URL.replace(/\/$/, "")}/v1/automation/events`;
  const body = {
    event: event.event,
    timestamp: new Date().toISOString(),
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
    error_code: event.errorCode ?? null,
    attributes: event.attributes ?? {},
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (fernToken !== null && fernToken.length > 0) {
    headers.Authorization = `Bearer ${fernToken}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      core.warning(`Automation Event API POST returned ${response.status} for ${event.event}`);
    }
  } catch (err) {
    core.warning(
      `Automation Event API POST failed for ${event.event}: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kicks off the POST immediately (fire-and-forget) and stores the
 * resulting promise so `shutdownFernAutomations()` can await it later.
 * No-op for non-`wrapper_failed` events (run-level events are
 * PostHog-only).
 */
export function captureFernAutomationsEvent(
  event: TelemetryEvent,
  context: TelemetryContext
): void {
  inflight.push(postAutomationEvent(event, context));
}

/**
 * Awaits every in-flight POST kicked off by `enqueueWrapperFailed`.
 * Idempotent — subsequent calls await an empty array.
 */
export async function shutdownFernAutomations(): Promise<void> {
  const pending = inflight;
  inflight = [];
  if (pending.length > 0) {
    await Promise.allSettled(pending);
  }
}

/** Test-only: resets module-level state. */
export function _resetFernAutomationsForTests(): void {
  fernToken = null;
  inflight = [];
}

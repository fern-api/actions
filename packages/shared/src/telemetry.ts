import * as core from "@actions/core";
import { getGithubRunId, getOrCreateRunId } from "./run-id.js";

/**
 * Structured telemetry event emitted to the action log.
 *
 * Events are written as a single JSON line prefixed with `::fern-telemetry::`
 * so log scrapers can pick them out without false positives. They carry both
 * FERN_RUN_ID (UUIDv4, unique per fern run) and GITHUB_RUN_ID (the workflow
 * run, useful for cross-referencing with the Actions UI and Sentry).
 *
 * Phase semantics:
 *   start — emitted by `recordStart` at the top of the main phase.
 *   end   — emitted by `instrumentAction` when the body completes successfully.
 *   error — emitted by `instrumentAction` when the body throws. No `end`
 *           event follows.
 *   post  — emitted by `runPostCleanup` from the post phase, carrying
 *           durationMs measured from the original start to the post-phase
 *           wall clock. `mainErrored` indicates whether the main phase
 *           reached an `error` event before the post phase ran.
 */
export interface TelemetryEvent {
  action: string;
  phase: "start" | "end" | "error" | "post";
  fernRunId: string;
  githubRunId: string;
  durationMs?: number;
  error?: string;
  mainErrored?: boolean;
  attributes?: Record<string, unknown>;
}

const TELEMETRY_PREFIX = "::fern-telemetry::";

const STATE_START_TIME = "fern_telemetry_start_ms";
const STATE_ACTION_NAME = "fern_telemetry_action";
const STATE_MAIN_ERRORED = "fern_telemetry_main_errored";
const STATE_FERN_RUN_ID = "fern_telemetry_run_id";

function emit(event: TelemetryEvent): void {
  core.info(`${TELEMETRY_PREFIX}${JSON.stringify(event)}`);
}

/**
 * Records start-of-action telemetry. Returns a function that emits the
 * matching `end` event with elapsed duration. Most actions should not call
 * this directly — use `instrumentAction` instead, which also handles errors
 * and post-phase cleanup.
 */
export function recordStart(action: string, attributes?: Record<string, unknown>): () => void {
  const startedAt = Date.now();
  const fernRunId = getOrCreateRunId();
  const githubRunId = getGithubRunId();

  emit({ action, phase: "start", fernRunId, githubRunId, attributes });

  core.saveState(STATE_START_TIME, String(startedAt));
  core.saveState(STATE_ACTION_NAME, action);
  core.saveState(STATE_FERN_RUN_ID, fernRunId);

  return () => {
    emit({
      action,
      phase: "end",
      fernRunId,
      githubRunId,
      durationMs: Date.now() - startedAt,
    });
  };
}

/**
 * Emits an error telemetry event and records that the main phase errored so
 * the post phase can label its event accordingly.
 */
export function recordError(
  action: string,
  err: unknown,
  attributes?: Record<string, unknown>
): void {
  const message = err instanceof Error ? err.message : String(err);
  core.saveState(STATE_MAIN_ERRORED, "true");
  emit({
    action,
    phase: "error",
    fernRunId: getOrCreateRunId(),
    githubRunId: getGithubRunId(),
    error: message,
    attributes,
  });
}

/**
 * Wraps an action body with telemetry start/end/error events. Use this from
 * the main phase. Pair with `runPostCleanup` in the post phase to emit
 * end-to-end duration including cleanup.
 */
export async function instrumentAction(
  action: string,
  fn: () => Promise<void>,
  attributes?: Record<string, unknown>
): Promise<void> {
  const finish = recordStart(action, attributes);
  try {
    await fn();
    finish();
  } catch (err) {
    recordError(action, err, attributes);
    throw err;
  }
}

/**
 * Run from the post phase. Reads the start state saved by `recordStart` and
 * emits a `post` telemetry event with cumulative duration (start → now). If
 * the main phase never recorded a start (e.g. it failed before recordStart),
 * this is a no-op rather than throwing — and it does NOT touch FERN_RUN_ID,
 * to avoid generating a fresh UUID for an action that never ran.
 *
 * Reads fernRunId from saved state (not from process.env) so the `post`
 * event always correlates with the matching `start` event, even if env-var
 * propagation between phases ever misbehaves.
 */
export function runPostCleanup(): void {
  const startedAtRaw = core.getState(STATE_START_TIME);
  const action = core.getState(STATE_ACTION_NAME);
  const fernRunId = core.getState(STATE_FERN_RUN_ID);
  if (!startedAtRaw || !action || !fernRunId) {
    return;
  }
  const startedAt = Number(startedAtRaw);
  if (!Number.isFinite(startedAt)) {
    return;
  }
  const mainErrored = core.getState(STATE_MAIN_ERRORED) === "true";
  emit({
    action,
    phase: "post",
    fernRunId,
    githubRunId: getGithubRunId(),
    durationMs: Date.now() - startedAt,
    mainErrored,
  });
}

import * as core from "@actions/core";
import { getOrCreateRunId } from "../run-id.js";
import {
  captureFernAutomationsEvent,
  injectFernToken as setFernAutomationsToken,
  shutdownFernAutomations,
} from "./automation-event-api.js";
import { WrapperError } from "./errors.js";
import { capturePostHogEvent, shutdownPostHog } from "./posthog.js";
import { captureSentryEvent, shutdownSentry } from "./sentry.js";
import { exportTelemetryContextEnv, getTelemetryContext } from "./telemetry-context.js";
import {
  EventName,
  type JsonValue,
  RunStatus,
  type TelemetryContext,
  type TelemetryEvent,
} from "./types.js";

const TELEMETRY_LOG_PREFIX = "::fern-telemetry::";

const STATE_ACTION_NAME = "fern_telemetry_action";
const STATE_FERN_RUN_ID = "fern_telemetry_run_id";
const STATE_OUTCOME = "fern_telemetry_outcome";

let signalHandlersInstalled = false;

export interface EmitOptions {
  /**
   * The original thrown error, when emitting `wrapper_failed`. Forwarded
   * to Sentry's `captureException` for stack-trace deobfuscation. Excluded
   * from `TelemetryEvent.attributes` because `Error` objects aren't
   * JSON-serializable and would either lose data or break the JsonValue
   * contract on the other sinks.
   */
  originalError?: unknown;
}

/**
 * Singleton client for wrapper-side telemetry. Owns:
 *
 *  - the resolved `TelemetryContext` (runId, githubRunId, config*,
 *    trigger, …), cached once per Node process via `init()` so every
 *    emitted event sees the same correlation IDs;
 *  - the orchestration of the four telemetry sinks (log line, PostHog,
 *    Sentry, Automation Event API).
 *
 * Use the singleton via the free function exports below
 * (`initTelemetry`, `emitTelemetryEvent`, `injectFernToken`,
 * `flushTelemetry`) so call sites stay function-shaped.
 */
class TelemetryClient {
  private _context: TelemetryContext | null = null;

  /**
   * Resolves the run's `TelemetryContext` and exports the
   * `FERN_CONFIG_*` env vars for any spawned CLI to inherit. Idempotent —
   * subsequent calls return the cached context without re-resolving or
   * re-exporting.
   */
  init(action: string) {
    if (this._context === null) {
      this._context = getTelemetryContext(action);
      exportTelemetryContextEnv(this._context);
    }
  }

  context(): TelemetryContext {
    if (this._context === null) {
      throw new WrapperError({
        errorCode: "CONTEXT_NOT_INITIALIZED",
        message: "Telemetry context not initialized. Call init() first.",
      });
    }
    return this._context;
  }

  injectFernToken(token: string): void {
    setFernAutomationsToken(token);
  }

  /**
   * Fans a telemetry event out to all four sinks:
   *
   * 1. `::fern-telemetry::<json>` log line — always.
   * 2. PostHog — always (no-op when key empty / not on runner).
   * 3. Sentry — only when `event === EventName.WrapperFailed`.
   * 4. Automation Event API — only when `event === EventName.WrapperFailed`.
   *    Promise enqueued for `flush()` to await.
   *
   * Calls `init()` if not already initialized so callers don't have to.
   */
  emit(event: TelemetryEvent, opts?: EmitOptions): void {
    const context = this.context();
    const logPayload = {
      event: event.event,
      action: context.action,
      ...(event.errorCode !== undefined ? { error_code: event.errorCode } : {}),
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
      ...(event.attributes ?? {}),
    };
    core.info(`${TELEMETRY_LOG_PREFIX}${JSON.stringify(logPayload)}`);

    capturePostHogEvent(event, context);
    captureFernAutomationsEvent(event, context);

    if (event.event === EventName.WrapperFailed) {
      captureSentryEvent(event, context, opts?.originalError);
    }
  }

  /**
   * Awaits every in-flight Automation Event API POST, then shuts down
   * the PostHog and Sentry SDK clients (which flushes their internal
   * queues). Called from `runAction` before `process.exit` so events
   * aren't lost. Idempotent.
   */
  async flush(): Promise<void> {
    await shutdownFernAutomations();
    await shutdownPostHog();
    await shutdownSentry();
  }

  /** Test-only: resets cached context. */
  _resetForTests(): void {
    this._context = null;
  }
}

const telemetryClient = new TelemetryClient();

/**
 * Resolves the `TelemetryContext` and exports `FERN_CONFIG_*` env vars
 * for child CLI processes. Idempotent. Call once at action start; later
 * `emitTelemetryEvent` calls reuse the cached context.
 */
export function initTelemetry(action: string): void {
  telemetryClient.init(action);
}

/**
 * Configures the Automation Event API client with the
 * `Authorization: Bearer ...` token. Call from inside
 * `instrumentAction`'s body after parsing inputs.
 */
export function injectFernToken(token: string): void {
  telemetryClient.injectFernToken(token);
}

/**
 * Fans a telemetry event out to all four sinks. See `TelemetryClient.emit`
 * for routing details.
 */
export function emitTelemetryEvent(event: TelemetryEvent, opts?: EmitOptions): void {
  telemetryClient.emit(event, opts);
}

/**
 * Awaits in-flight Automation Event API POSTs and flushes the PostHog /
 * Sentry SDK queues. Called from `runAction` before `process.exit`.
 */
export async function flushTelemetry(): Promise<void> {
  await telemetryClient.flush();
}

/** Test-only: resets the singleton's cached context. */
export function _resetTelemetryContextForTests(): void {
  telemetryClient._resetForTests();
}

// ---------------------------------------------------------------------------
// Phase wiring (main + post phase orchestration)
// ---------------------------------------------------------------------------

/**
 * Installs SIGINT/SIGTERM handlers that mark the run outcome as `cancelled`
 * before the process is terminated. The post phase reads this flag and
 * emits `automation_run_completed` with `status: cancelled`. Idempotent —
 * safe to call multiple times across a single Node process.
 *
 * The handler exits with the conventional signal-shifted code (130 / 143)
 * so any parent shell or runner sees the standard exit signature. We do
 * NOT emit `wrapper_failed` from cancellation — cancellation is not a
 * wrapper-side fault.
 */
function installSignalHandlers(): void {
  if (signalHandlersInstalled) {
    return;
  }
  signalHandlersInstalled = true;
  const onSignal = (signal: "SIGINT" | "SIGTERM", code: number) => () => {
    core.saveState(STATE_OUTCOME, RunStatus.Cancelled);
    core.info(`${TELEMETRY_LOG_PREFIX}received ${signal}, marking run as cancelled`);
    process.exit(code);
  };
  process.on("SIGINT", onSignal("SIGINT", 130));
  process.on("SIGTERM", onSignal("SIGTERM", 143));
}

/**
 * Records start-of-action telemetry and emits `automation_run_started` to
 * every sink. Resolves the telemetry context (and exports `FERN_CONFIG_*`
 * env vars) so any spawned CLI inherits them.
 *
 * Returns a function that, when called, marks the outcome as `success` so
 * the post phase emits `automation_run_completed` with that status.
 *
 * Most actions should not call this directly — use `instrumentAction`
 * instead, which also handles errors and post-phase cleanup.
 */
export function recordStart(action: string, attributes?: Record<string, JsonValue>): () => void {
  installSignalHandlers();

  emitTelemetryEvent({
    event: EventName.AutomationRunStarted,
    attributes,
  });

  core.saveState(STATE_ACTION_NAME, action);
  core.saveState(STATE_FERN_RUN_ID, getOrCreateRunId());

  return () => {
    core.saveState(STATE_OUTCOME, RunStatus.Success);
  };
}

/**
 * Classifies the thrown error and emits `wrapper_failed` to every sink.
 * Records the outcome as `failure` so the post phase emits
 * `automation_run_completed` with that status.
 */
export function recordError(err: unknown): void {
  let errorCode: string;
  let errorMessage: string;
  let originalError: unknown;

  if (err instanceof WrapperError) {
    errorCode = err.errorCode;
    errorMessage = err.message;
    originalError = err.originalError;
  } else {
    errorCode = "UNKNOWN_ERROR";
    errorMessage = err instanceof Error ? err.message : String(err);
    originalError = err instanceof Error ? err : undefined;
  }

  emitTelemetryEvent(
    {
      event: EventName.WrapperFailed,
      errorCode,
      attributes: { error_message: errorMessage },
    },
    { originalError }
  );

  core.saveState(STATE_OUTCOME, RunStatus.Failure);
}

/**
 * Wraps an action body with telemetry start/error events. Use this from
 * the main phase. Pair with `runPostCleanup` in the post phase to emit
 * `automation_run_completed` with the final status.
 *
 * Input parsing should happen INSIDE `fn` so parse failures get classified
 * as `wrapper_failed` via the catch path. To set the Automation Event API
 * auth token after parsing, call `injectFernToken(...)` inside `fn` before
 * kicking off the real work.
 */
export async function instrumentAction(
  action: string,
  fn: () => Promise<void>,
  attributes?: Record<string, JsonValue>
): Promise<void> {
  initTelemetry(action);
  const finish = recordStart(action, attributes);
  try {
    await fn();
    finish();
  } catch (err) {
    recordError(err);
    throw err;
  }
}

/**
 * Run from the post phase. Reads the start state saved by `recordStart`
 * and emits `automation_run_completed` with the run's final status
 * (`success` / `failure` / `cancelled`). If the main phase never recorded
 * a start (e.g. it failed before recordStart), this is a no-op rather
 * than throwing.
 */
export function runPostCleanup(): void {
  const action = core.getState(STATE_ACTION_NAME);
  const fernRunId = core.getState(STATE_FERN_RUN_ID);
  if (!action || !fernRunId) {
    return;
  }
  const outcome = (core.getState(STATE_OUTCOME) || RunStatus.Failure) as RunStatus;

  initTelemetry(action);

  const event: TelemetryEvent = {
    event: EventName.AutomationRunCompleted,
    attributes: { status: outcome },
  };
  emitTelemetryEvent(event);
}

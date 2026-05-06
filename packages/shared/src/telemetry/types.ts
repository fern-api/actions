export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const EventName = {
  AutomationRunStarted: "automation_run_started",
  AutomationRunCompleted: "automation_run_completed",
  WrapperFailed: "wrapper_failed",
} as const;
export type EventName = (typeof EventName)[keyof typeof EventName];

export const RunStatus = {
  Success: "success",
  Failure: "failure",
  Cancelled: "cancelled",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export interface TelemetryContext {
  runId: string;
  githubRunId: string | undefined;
  githubRunUrl: string | undefined;
  action: string;
  org: string | undefined;
  configRepo: string | undefined;
  configCommitSha: string | undefined;
  configBranch: string | undefined;
  configPrNumber: string | undefined;
  trigger: string | undefined;
  cliVersion: string | undefined;
}

/**
 * Structured telemetry event. Carries only the fields specific to the
 * event itself; the run-level correlation IDs (runId, githubRunId,
 * org, config*, trigger, cliVersion) live on the `TelemetryContext`
 * passed alongside every emit. Sinks that produce a single payload — the
 * log line, the PostHog properties bag, the Automation Event API body —
 * flatten event + context together at emission time, mapping each field
 * to its snake_case wire key.
 *
 * Attribute values must be JSON-serializable.
 */
export interface TelemetryEvent {
  event: EventName;
  errorCode?: string;
  attributes?: Record<string, JsonValue>;
}

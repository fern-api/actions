/**
 * Verifies that the PostHog, Sentry, and Automation Event API sinks are silent
 * no-ops when running outside a GitHub Actions runner (i.e. local dev).
 * This is the build-time guard: telemetry never
 * fires from a non-runner process, so dev builds can't pollute prod
 * dashboards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventName } from "./types.js";

vi.mock("@actions/core");

const ENV_KEYS = ["GITHUB_ACTIONS", "FERN_RUN_ID", "GITHUB_RUN_ID", "GITHUB_REPOSITORY"] as const;

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

const wrapperFailedEvent = {
  event: EventName.WrapperFailed,
  action: "test",
  fernRunId: "11111111-1111-4111-8111-111111111111",
  githubRunId: "1",
  attributes: { error_message: "test" },
};

describe("PostHog sink (no-op outside runner)", () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it("capturePostHogEvent is a no-op when GITHUB_ACTIONS is unset", async () => {
    const { capturePostHogEvent, shutdownPostHog } = await import("./posthog.js");
    expect(() => capturePostHogEvent(wrapperFailedEvent, makeContext())).not.toThrow();
    await expect(shutdownPostHog()).resolves.toBeUndefined();
  });
});

describe("Sentry sink (no-op outside runner)", () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it("captureWrapperFailed is a no-op when GITHUB_ACTIONS is unset", async () => {
    const { captureSentryEvent: captureWrapperFailed, shutdownSentry } = await import(
      "./sentry.js"
    );
    expect(() =>
      captureWrapperFailed(wrapperFailedEvent, makeContext(), new Error("test"))
    ).not.toThrow();
    await expect(shutdownSentry()).resolves.toBeUndefined();
  });
});

describe("Automation Event API sink (no-op outside runner)", () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it("enqueueWrapperFailed is a no-op when GITHUB_ACTIONS is unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const {
      _resetFernAutomationsForTests,
      captureFernAutomationsEvent: enqueueWrapperFailed,
      shutdownFernAutomations,
    } = await import("./automation-event-api.js");
    _resetFernAutomationsForTests();
    enqueueWrapperFailed(wrapperFailedEvent, makeContext());
    await shutdownFernAutomations();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

function makeContext() {
  return {
    runId: "11111111-1111-4111-8111-111111111111",
    githubRunId: "1",
    githubRunUrl: "",
    org: "square",
    configRepo: "square/fern-config",
    configCommitSha: "abc1234",
    configBranch: "main",
    configPrNumber: undefined,
    trigger: "push",
    cliVersion: undefined,
    action: "test",
  };
}

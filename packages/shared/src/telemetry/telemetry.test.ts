import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WrapperError } from "./errors.js";
import { _resetTelemetryContextForTests, instrumentAction, runPostCleanup } from "./telemetry.js";
import { EventName, RunStatus } from "./types.js";

vi.mock("@actions/core");

interface MockedCore {
  info: ReturnType<typeof vi.fn>;
  saveState: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  exportVariable: ReturnType<typeof vi.fn>;
}

const mockedCore = core as unknown as MockedCore;

function infoCalls(): string[] {
  return mockedCore.info.mock.calls.map((c) => c[0] as string);
}

function telemetryEvents(): Array<Record<string, unknown>> {
  return infoCalls()
    .filter((line) => line.startsWith("::fern-telemetry::") && line.includes("{"))
    .map((line) => JSON.parse(line.replace("::fern-telemetry::", "")) as Record<string, unknown>);
}

describe("instrumentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTelemetryContextForTests();
    process.env.FERN_RUN_ID = "11111111-1111-4111-8111-111111111111";
    process.env.GITHUB_RUN_ID = "999";
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.FERN_RUN_ID;
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.GITHUB_RUN_ID;
  });

  it("emits automation_run_started and saves outcome=success on success", async () => {
    await instrumentAction("test-action", async () => {});

    const events = telemetryEvents();
    expect(events.map((e) => e.event)).toEqual([EventName.AutomationRunStarted]);
    expect(events[0].action).toBe("test-action");
    expect(events[0].run_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(events[0].github_run_id).toBe("999");

    const savedKeys = mockedCore.saveState.mock.calls.map((c) => c[0]);
    expect(savedKeys).toContain("fern_telemetry_action");
    expect(savedKeys).toContain("fern_telemetry_run_id");
    expect(savedKeys).toContain("fern_telemetry_outcome");
    const outcomeCall = mockedCore.saveState.mock.calls.find(
      (c) => c[0] === "fern_telemetry_outcome"
    );
    expect(outcomeCall?.[1]).toBe("success");
  });

  it("emits wrapper_failed with error_message when an arbitrary error throws", async () => {
    await expect(
      instrumentAction("test-action", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const events = telemetryEvents();
    expect(events.map((e) => e.event)).toEqual([
      EventName.AutomationRunStarted,
      EventName.WrapperFailed,
    ]);
    const wrapperFailed = events[1];
    expect(wrapperFailed.error_message).toBe("boom");
    expect(wrapperFailed.error_code).toBe("UNKNOWN_ERROR");

    const outcomeCall = mockedCore.saveState.mock.calls.find(
      (c) => c[0] === "fern_telemetry_outcome"
    );
    expect(outcomeCall?.[1]).toBe("failure");
  });

  it("emits wrapper_failed with the WrapperError's error_code", async () => {
    await expect(
      instrumentAction("test-action", async () => {
        throw new WrapperError({
          errorCode: "CLI_INSTALL_NPM_FAILED",
          message: "npm install failed",
        });
      })
    ).rejects.toBeInstanceOf(WrapperError);

    const events = telemetryEvents();
    const wrapperFailed = events.find((e) => e.event === EventName.WrapperFailed);
    expect(wrapperFailed).toBeDefined();
    expect(wrapperFailed?.error_code).toBe("CLI_INSTALL_NPM_FAILED");
    expect(wrapperFailed?.error_message).toBe("npm install failed");
  });
});

describe("runPostCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTelemetryContextForTests();
    // Real workflow: the main phase exports FERN_RUN_ID via core.exportVariable,
    // the runner propagates it to the post phase's process env. Mirror that
    // here so getAutomationContext() resolves the same run_id as the matching
    // recordStart did.
    process.env.FERN_RUN_ID = "22222222-2222-4222-8222-222222222222";
    process.env.GITHUB_RUN_ID = "999";
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.FERN_RUN_ID;
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.GITHUB_RUN_ID;
  });

  function setState(state: Record<string, string>) {
    mockedCore.getState.mockImplementation((key: string) => state[key] ?? "");
  }

  it("emits automation_run_completed status=success when outcome=success", () => {
    setState({
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
      fern_telemetry_outcome: RunStatus.Success,
    });

    runPostCleanup();

    const events = telemetryEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe(EventName.AutomationRunCompleted);
    expect(events[0].action).toBe("test-action");
    expect(events[0].run_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(events[0].github_run_id).toBe("999");
    expect(events[0].status).toBe("success");
    expect(events[0].duration_ms).toBeUndefined();
  });

  it("emits status=failure when outcome=failure was saved by recordError", () => {
    setState({
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
      fern_telemetry_outcome: RunStatus.Failure,
    });

    runPostCleanup();

    const events = telemetryEvents();
    expect(events[0].status).toBe("failure");
  });

  it("emits status=cancelled when outcome=cancelled was saved by the signal handler", () => {
    setState({
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
      fern_telemetry_outcome: RunStatus.Cancelled,
    });

    runPostCleanup();

    const events = telemetryEvents();
    expect(events[0].status).toBe("cancelled");
  });

  it("defaults to status=failure when no outcome state is set (e.g. uncaught process exit)", () => {
    setState({
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
    });

    runPostCleanup();

    const events = telemetryEvents();
    expect(events[0].status).toBe("failure");
  });

  it("is a no-op when state is missing (action never started)", () => {
    setState({});

    runPostCleanup();

    expect(telemetryEvents()).toEqual([]);
    expect(mockedCore.exportVariable).not.toHaveBeenCalled();
  });
});

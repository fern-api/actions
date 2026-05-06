import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { instrumentAction, runPostCleanup } from "./telemetry.js";

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
    .filter((line) => line.startsWith("::fern-telemetry::"))
    .map((line) => JSON.parse(line.replace("::fern-telemetry::", "")) as Record<string, unknown>);
}

describe("instrumentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FERN_RUN_ID = "11111111-1111-4111-8111-111111111111";
    process.env.GITHUB_RUN_ID = "999";
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.FERN_RUN_ID;
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.GITHUB_RUN_ID;
  });

  it("emits start then end on success and saves state for the post phase", async () => {
    await instrumentAction("test-action", async () => {});

    const events = telemetryEvents();
    expect(events.map((e) => e.phase)).toEqual(["start", "end"]);
    expect(events[0].action).toBe("test-action");
    expect(events[0].fernRunId).toBe("11111111-1111-4111-8111-111111111111");
    expect(events[0].githubRunId).toBe("999");
    expect(typeof events[1].durationMs).toBe("number");

    const savedKeys = mockedCore.saveState.mock.calls.map((c) => c[0]);
    expect(savedKeys).toContain("fern_telemetry_start_ms");
    expect(savedKeys).toContain("fern_telemetry_action");
    expect(savedKeys).toContain("fern_telemetry_run_id");
  });

  it("emits start then error (no end) when the body throws", async () => {
    await expect(
      instrumentAction("test-action", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const events = telemetryEvents();
    expect(events.map((e) => e.phase)).toEqual(["start", "error"]);
    expect(events[1].error).toBe("boom");

    const savedKeys = mockedCore.saveState.mock.calls.map((c) => c[0]);
    expect(savedKeys).toContain("fern_telemetry_main_errored");
  });
});

describe("runPostCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_RUN_ID = "999";
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.GITHUB_RUN_ID;
  });

  function setState(state: Record<string, string>) {
    mockedCore.getState.mockImplementation((key: string) => state[key] ?? "");
  }

  it("emits a post event with cumulative duration when state is present", () => {
    setState({
      fern_telemetry_start_ms: String(Date.now() - 1000),
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
    });

    runPostCleanup();

    const events = telemetryEvents();
    expect(events).toHaveLength(1);
    expect(events[0].phase).toBe("post");
    expect(events[0].action).toBe("test-action");
    expect(events[0].fernRunId).toBe("22222222-2222-4222-8222-222222222222");
    expect(events[0].mainErrored).toBe(false);
    expect(events[0].durationMs).toBeGreaterThanOrEqual(1000);
  });

  it("marks mainErrored=true when the main phase recorded an error", () => {
    setState({
      fern_telemetry_start_ms: String(Date.now() - 1000),
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
      fern_telemetry_main_errored: "true",
    });

    runPostCleanup();

    const events = telemetryEvents();
    expect(events[0].mainErrored).toBe(true);
  });

  it("is a no-op when state is missing (action never started)", () => {
    setState({});

    runPostCleanup();

    expect(telemetryEvents()).toEqual([]);
    expect(mockedCore.exportVariable).not.toHaveBeenCalled();
  });

  it("is a no-op when start time is unparseable", () => {
    setState({
      fern_telemetry_start_ms: "not-a-number",
      fern_telemetry_action: "test-action",
      fern_telemetry_run_id: "22222222-2222-4222-8222-222222222222",
    });

    runPostCleanup();

    expect(telemetryEvents()).toEqual([]);
  });
});

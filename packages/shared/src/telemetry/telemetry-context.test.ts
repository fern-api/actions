import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportTelemetryContextEnv, getTelemetryContext } from "./telemetry-context.js";

vi.mock("@actions/core");

interface MockedCore {
  exportVariable: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

const mockedCore = core as unknown as MockedCore;

const ENV_KEYS = [
  "FERN_AUTOMATION",
  "FERN_RUN_ID",
  "FERN_GITHUB_RUN_URL",
  "FERN_ORG",
  "FERN_CONFIG_REPO",
  "FERN_CONFIG_COMMIT_SHA",
  "FERN_CONFIG_BRANCH",
  "FERN_CONFIG_PR_NUMBER",
  "GITHUB_RUN_ID",
  "GITHUB_SERVER_URL",
  "GITHUB_REPOSITORY",
  "GITHUB_SHA",
  "GITHUB_HEAD_REF",
  "GITHUB_REF_NAME",
  "GITHUB_REF",
  "GITHUB_EVENT_NAME",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

/**
 * Make a temp dir with no fern.config.json above it so the org-resolution
 * file walk reliably returns undefined unless a test sets one up.
 */
function makeIsolatedTempCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fern-actions-test-"));
}

describe("getAutomationContext", () => {
  let originalCwd: string;
  let tmpCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    clearEnv();
    originalCwd = process.cwd();
    tmpCwd = makeIsolatedTempCwd();
    process.chdir(tmpCwd);
    process.env.FERN_RUN_ID = "11111111-1111-4111-8111-111111111111";
    process.env.GITHUB_RUN_ID = "555";
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_REPOSITORY = "square/fern-config";
    process.env.GITHUB_SHA = "abc1234";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_EVENT_NAME = "push";
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpCwd, { recursive: true, force: true });
    clearEnv();
  });

  it("populates the common fields from the GitHub runtime env", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    fs.writeFileSync(
      path.join(tmpCwd, "fern", "fern.config.json"),
      JSON.stringify({ organization: "square", version: "0.0.1" })
    );
    const ctx = getTelemetryContext("test-action");
    expect(ctx.runId).toBe("11111111-1111-4111-8111-111111111111");
    expect(ctx.githubRunId).toBe("555");
    expect(ctx.githubRunUrl).toBe("https://github.com/square/fern-config/actions/runs/555");
    expect(ctx.org).toBe("square");
    expect(ctx.configRepo).toBe("square/fern-config");
    expect(ctx.configCommitSha).toBe("abc1234");
    expect(ctx.configBranch).toBe("main");
    expect(ctx.configPrNumber).toBeUndefined();
    expect(ctx.trigger).toBe("push");
  });

  it("prefers FERN_CONFIG_* overrides over GITHUB_* defaults", () => {
    process.env.FERN_CONFIG_REPO = "square/fern-square-py";
    process.env.FERN_CONFIG_COMMIT_SHA = "def5678";
    process.env.FERN_CONFIG_BRANCH = "release/1.0";
    process.env.FERN_CONFIG_PR_NUMBER = "42";

    const ctx = getTelemetryContext("test-action");
    expect(ctx.configRepo).toBe("square/fern-square-py");
    expect(ctx.configCommitSha).toBe("def5678");
    expect(ctx.configBranch).toBe("release/1.0");
    expect(ctx.configPrNumber).toBe("42");
  });

  it("extracts the PR number from refs/pull/<n>/merge when FERN_CONFIG_PR_NUMBER is unset", () => {
    process.env.GITHUB_REF = "refs/pull/123/merge";
    expect(getTelemetryContext("test-action").configPrNumber).toBe("123");
  });

  it("prefers GITHUB_HEAD_REF over GITHUB_REF_NAME for the branch when set (PR builds)", () => {
    process.env.GITHUB_HEAD_REF = "feature/foo";
    expect(getTelemetryContext("test-action").configBranch).toBe("feature/foo");
  });

  it("leaves org undefined when ProjectConfig.tryLoad() finds no fern.config.json", () => {
    expect(getTelemetryContext("test-action").org).toBeUndefined();
  });
});

describe("exportAutomationContextEnv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports each non-empty automation context field via core.exportVariable", () => {
    exportTelemetryContextEnv({
      runId: "x",
      githubRunId: "y",
      githubRunUrl: "z",
      org: "square",
      configRepo: "square/fern-config",
      configCommitSha: "abc1234",
      configBranch: "main",
      configPrNumber: "42",
      trigger: "push",
      cliVersion: undefined,
      action: "test-action",
    });
    const calls = mockedCore.exportVariable.mock.calls.map((c) => c[0]);
    expect(mockedCore.exportVariable).toHaveBeenCalledWith("FERN_AUTOMATION", "true");
    expect(calls).toContain("FERN_GITHUB_RUN_URL");
    expect(calls).not.toContain("FERN_ORG");
    expect(calls).toContain("FERN_CONFIG_REPO");
    expect(calls).toContain("FERN_CONFIG_COMMIT_SHA");
    expect(calls).toContain("FERN_CONFIG_BRANCH");
    expect(calls).toContain("FERN_CONFIG_PR_NUMBER");
    expect(calls).toContain("FERN_ACTION");
  });

  it("omits empty/undefined optional fields so the CLI's own fallback can run", () => {
    exportTelemetryContextEnv({
      runId: "x",
      action: "test-action",
      githubRunId: undefined,
      githubRunUrl: undefined,
      org: undefined,
      configRepo: undefined,
      configCommitSha: undefined,
      configBranch: undefined,
      configPrNumber: undefined,
      trigger: undefined,
      cliVersion: undefined,
    });
    expect(mockedCore.exportVariable).toHaveBeenCalledWith("FERN_AUTOMATION", "true");
    expect(mockedCore.exportVariable).toHaveBeenCalledWith("FERN_ACTION", "test-action");
    expect(mockedCore.exportVariable).toHaveBeenCalledTimes(2);
  });
});

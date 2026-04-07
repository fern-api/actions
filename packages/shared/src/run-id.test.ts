import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGithubRunId, getOrCreateRunId } from "./run-id.js";

vi.mock("@actions/core");

describe("getOrCreateRunId", () => {
  beforeEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.FERN_RUN_ID;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.FERN_RUN_ID;
  });

  it("generates a new UUIDv4 and exports it when FERN_RUN_ID is not set", () => {
    const runId = getOrCreateRunId();

    expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(core.exportVariable).toHaveBeenCalledWith("FERN_RUN_ID", runId);
  });

  it("inherits existing FERN_RUN_ID from environment without generating a new one", () => {
    const existing = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    process.env.FERN_RUN_ID = existing;

    const runId = getOrCreateRunId();

    expect(runId).toBe(existing);
    expect(core.exportVariable).not.toHaveBeenCalled();
  });

  it("returns a different ID on each call when env is not set", () => {
    const first = getOrCreateRunId();
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.FERN_RUN_ID;
    const second = getOrCreateRunId();

    expect(first).not.toBe(second);
  });
});

describe("getGithubRunId", () => {
  afterEach(() => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.GITHUB_RUN_ID;
  });

  it("returns GITHUB_RUN_ID from environment", () => {
    process.env.GITHUB_RUN_ID = "12345678";
    expect(getGithubRunId()).toBe("12345678");
  });

  it("returns empty string when GITHUB_RUN_ID is not set", () => {
    // biome-ignore lint/performance/noDelete: process.env coerces to string, delete is required to unset
    delete process.env.GITHUB_RUN_ID;
    expect(getGithubRunId()).toBe("");
  });
});

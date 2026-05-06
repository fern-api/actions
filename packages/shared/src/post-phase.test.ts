import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPostPhase, markMainPhaseStarted } from "./post-phase.js";

vi.mock("@actions/core");

interface MockedCore {
  saveState: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
}

const mockedCore = core as unknown as MockedCore;

describe("post-phase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("markMainPhaseStarted writes 'true' to fern_is_post state", () => {
    markMainPhaseStarted();
    expect(mockedCore.saveState).toHaveBeenCalledWith("fern_is_post", "true");
  });

  it("isPostPhase returns true when fern_is_post state is 'true'", () => {
    mockedCore.getState.mockReturnValue("true");
    expect(isPostPhase()).toBe(true);
    expect(mockedCore.getState).toHaveBeenCalledWith("fern_is_post");
  });

  it("isPostPhase returns false when state is empty (main phase)", () => {
    mockedCore.getState.mockReturnValue("");
    expect(isPostPhase()).toBe(false);
  });

  it("isPostPhase returns false for any non-'true' value", () => {
    mockedCore.getState.mockReturnValue("yes");
    expect(isPostPhase()).toBe(false);
  });
});

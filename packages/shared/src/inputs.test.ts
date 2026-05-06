import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOptionalInput,
  getRequiredFernToken,
  getRequiredInput,
  parseRepository,
} from "./index.js";

vi.mock("@actions/core");

interface MockedCore {
  getInput: ReturnType<typeof vi.fn>;
  setSecret: ReturnType<typeof vi.fn>;
}

const mockedCore = core as unknown as MockedCore;

describe("getRequiredInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the value when present", () => {
    mockedCore.getInput.mockReturnValue("hello");
    expect(getRequiredInput("greeting")).toBe("hello");
    expect(mockedCore.getInput).toHaveBeenCalledWith("greeting", { required: true });
  });

  it("throws when the input is empty", () => {
    mockedCore.getInput.mockReturnValue("");
    expect(() => getRequiredInput("greeting")).toThrow(/'greeting' is required/);
  });
});

describe("getOptionalInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the value when present", () => {
    mockedCore.getInput.mockReturnValue("hello");
    expect(getOptionalInput("greeting")).toBe("hello");
  });

  it("returns undefined when the input is empty", () => {
    mockedCore.getInput.mockReturnValue("");
    expect(getOptionalInput("greeting")).toBeUndefined();
  });
});

describe("getRequiredFernToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the token and marks it secret when set", () => {
    mockedCore.getInput.mockReturnValue("super-secret-token");
    expect(getRequiredFernToken()).toBe("super-secret-token");
    expect(mockedCore.setSecret).toHaveBeenCalledWith("super-secret-token");
  });

  it("throws the actionable token-help message when missing", () => {
    mockedCore.getInput.mockReturnValue("");
    expect(() => getRequiredFernToken()).toThrow(/Add it as a repository secret/);
    expect(mockedCore.setSecret).not.toHaveBeenCalled();
  });

  it("does not call setSecret when the input is empty", () => {
    mockedCore.getInput.mockReturnValue("");
    expect(() => getRequiredFernToken()).toThrow();
    expect(mockedCore.setSecret).not.toHaveBeenCalled();
  });
});

describe("parseRepository", () => {
  it("parses owner/name format", () => {
    expect(parseRepository("fern-api/fern")).toEqual({
      owner: "fern-api",
      name: "fern",
      fullName: "fern-api/fern",
    });
  });

  it("rejects strings without a slash", () => {
    expect(() => parseRepository("fern")).toThrow(/Invalid repository format/);
  });

  it("rejects strings with too many slashes", () => {
    expect(() => parseRepository("a/b/c")).toThrow(/Invalid repository format/);
  });

  it("rejects empty owner", () => {
    expect(() => parseRepository("/repo")).toThrow(/Invalid repository format/);
  });

  it("rejects empty name", () => {
    expect(() => parseRepository("owner/")).toThrow(/Invalid repository format/);
  });
});

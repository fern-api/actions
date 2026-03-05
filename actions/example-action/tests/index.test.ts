import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
}));

import * as core from "@actions/core";
import { parseRepository } from "@fern-github-actions/shared";

describe("example-action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseRepository", () => {
    it("parses a valid owner/repo string", () => {
      const result = parseRepository("fern-api/fern");
      expect(result).toEqual({
        owner: "fern-api",
        name: "fern",
        fullName: "fern-api/fern",
      });
    });

    it("throws on invalid format", () => {
      expect(() => parseRepository("invalid")).toThrow("Invalid repository format");
    });
  });

  describe("input parsing", () => {
    it("reads required inputs", () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        if (name === "github-token") return "ghp_testtoken";
        if (name === "message") return "hello world";
        return "";
      });
      vi.mocked(core.getBooleanInput).mockReturnValue(false);

      expect(core.getInput("github-token")).toBe("ghp_testtoken");
      expect(core.getInput("message")).toBe("hello world");
    });
  });
});

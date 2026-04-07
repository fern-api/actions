import { describe, expect, it, vi } from "vitest";

// Mock @actions/core before importing the module under test
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@actions/exec", () => ({
  exec: vi.fn(),
}));

import { REPO_PATTERN, sanitizeTokenFromMessage } from "./push-diff.js";

describe("REPO_PATTERN", () => {
  it.each(["acme/ts-sdk", "my-org/my.repo", "org/repo_name", "org/repo-name.js"])(
    "accepts valid repo: %s",
    (repo) => {
      expect(REPO_PATTERN.test(repo)).toBe(true);
    }
  );

  it.each([
    "",
    "no-slash",
    "has/two/slashes",
    "has spaces/repo",
    "../path-traversal/repo",
    "org/repo; rm -rf /",
  ])("rejects invalid repo: %s", (repo) => {
    expect(REPO_PATTERN.test(repo)).toBe(false);
  });
});

describe("sanitizeTokenFromMessage", () => {
  it("strips token from clone URL in error message", () => {
    const input =
      "fatal: could not read from remote repository 'https://x-access-token:ghp_abc123@github.com/org/repo.git'";
    const result = sanitizeTokenFromMessage(input);
    expect(result).toContain("x-access-token:***@");
    expect(result).not.toContain("ghp_abc123");
  });

  it("returns messages with no token unchanged", () => {
    const input = "some other error";
    expect(sanitizeTokenFromMessage(input)).toBe(input);
  });

  it("strips multiple tokens in one message", () => {
    const input =
      "clone https://x-access-token:tok1@github.com/a/b.git and https://x-access-token:tok2@github.com/c/d.git";
    const result = sanitizeTokenFromMessage(input);
    expect(result).not.toContain("tok1");
    expect(result).not.toContain("tok2");
    expect(result).toBe(
      "clone https://x-access-token:***@github.com/a/b.git and https://x-access-token:***@github.com/c/d.git"
    );
  });

  it("handles empty string", () => {
    expect(sanitizeTokenFromMessage("")).toBe("");
  });
});

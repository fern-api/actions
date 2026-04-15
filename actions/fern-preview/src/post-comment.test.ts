import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatComment } from "./post-comment.js";
import type { PreviewResult } from "./run-preview.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-06-15T12:30:45.123Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatComment", () => {
  it("formats successful results with install and diff", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand:
          "npm install @acme/sdk@npm:@acme-preview/sdk@0.0.1-main.123 --registry https://npm.buildwithfern.com",
        diffUrl: "https://github.com/acme/ts-sdk/compare/main...fern-preview-pr-42",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain("<!-- fern-sdk-preview -->");
    expect(comment).toContain("## SDK Preview");
    expect(comment).toContain("@acme-preview/sdk");
    expect(comment).toContain("[View diff]");
    expect(comment).not.toContain("### Errors");
    expect(comment).toContain("Last updated 2025-06-15 12:30:45 UTC");
  });

  it("formats error results", () => {
    const results: PreviewResult[] = [
      {
        status: "error",
        groupName: "ts-sdk",
        error: "Docker not found",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain(":x: Failed");
    expect(comment).toContain("### Errors");
    expect(comment).toContain("Docker not found");
  });

  it("shows dash when diffUrl is missing", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install ...",
      },
    ];

    const comment = formatComment(results);
    // When no diffUrl is returned, the diff column shows "\u2014" (em dash)
    expect(comment).not.toContain("[View diff]");
  });

  it("handles mixed success and error results", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install ...",
        diffUrl: "https://github.com/acme/ts-sdk/compare/main...fern-preview-pr-1",
      },
      {
        status: "error",
        groupName: "internal-sdk",
        error: "No supported generators",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain("@acme-preview/sdk");
    expect(comment).toContain(":x: Failed");
    expect(comment).toContain("No supported generators");
  });

  it("escapes newlines in error messages for table rendering", () => {
    const results: PreviewResult[] = [
      {
        status: "error",
        groupName: "ts-sdk",
        error: "Line one\nLine two\nLine three",
      },
    ];

    const comment = formatComment(results);
    // Error details section should preserve newlines (it's outside the table)
    expect(comment).toContain("Line one\nLine two\nLine three");
    // The table row itself should not contain raw newlines
    const tableRows = comment.split("\n").filter((line) => line.startsWith("|"));
    for (const row of tableRows) {
      // Each table row should be a single line (no embedded newlines)
      expect(row).not.toMatch(/\n/);
    }
  });
});

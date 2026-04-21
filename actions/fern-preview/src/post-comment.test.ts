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
    // Table has Group and Preview changes columns (no Status column)
    expect(comment).toContain("| Group | Preview changes |");
    expect(comment).not.toContain("| Status");
    expect(comment).toContain("[Preview changes]");
    // Install command is in a code block below the table
    expect(comment).toContain("### Test install your SDK");
    expect(comment).toContain(
      "```sh\nnpm install @acme/sdk@npm:@acme-preview/sdk@0.0.1-main.123 --registry https://npm.buildwithfern.com\n```"
    );
    // Package column removed
    expect(comment).not.toContain("| Package |");
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
    // When no diffUrl is returned, the preview changes column shows em dash
    expect(comment).not.toContain("[Preview changes]");
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
    expect(comment).toContain("[Preview changes]");
    expect(comment).toContain(":x: Failed");
    expect(comment).toContain("No supported generators");
    // Install section should show the successful group
    expect(comment).toContain("### Test install your SDK");
    expect(comment).toContain("```sh\nnpm install ...\n```");
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
    // Error details section should contain all lines (markdown-escaped but present)
    expect(comment).toContain("Line one");
    expect(comment).toContain("Line two");
    expect(comment).toContain("Line three");
    // The table row itself should not contain raw newlines
    const tableRows = comment.split("\n").filter((line) => line.startsWith("|"));
    for (const row of tableRows) {
      // Each table row should be a single line (no embedded newlines)
      expect(row).not.toMatch(/\n/);
    }
  });

  it("rejects non-https diff URLs", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install ...",
        diffUrl: "javascript:alert(1)",
      },
    ];

    const comment = formatComment(results);
    expect(comment).not.toContain("[Preview changes]");
    expect(comment).not.toContain("javascript:");
  });

  it("install command in code block is not HTML-escaped", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install @acme/<preview>/sdk@0.0.1",
      },
    ];

    const comment = formatComment(results);
    // Code blocks don't need HTML escaping — GitHub renders them as-is
    expect(comment).toContain("```sh\nnpm install @acme/<preview>/sdk@0.0.1\n```");
  });

  it("escapes markdown special characters in error messages", () => {
    const results: PreviewResult[] = [
      {
        status: "error",
        groupName: "ts-sdk",
        error: "**bold** [link](http://evil.com)",
      },
    ];

    const comment = formatComment(results);
    // The markdown special characters should be escaped in the error section
    expect(comment).not.toContain("[link](http://evil.com)");
    expect(comment).toContain("\\*\\*bold\\*\\*");
  });

  it("labels groups when multiple successful results exist", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install @acme/sdk@npm:@acme-preview/sdk@0.0.1",
        diffUrl: "https://github.com/acme/ts-sdk/compare/main...fern-preview-pr-1",
      },
      {
        status: "success",
        groupName: "node-sdk",
        packageName: "@acme-preview/node",
        installCommand: "npm install @acme/node@npm:@acme-preview/node@0.0.1",
        diffUrl: "https://github.com/acme/node-sdk/compare/main...fern-preview-pr-1",
      },
    ];

    const comment = formatComment(results);
    // When multiple groups succeed, each install block is labeled
    expect(comment).toContain("**ts\\-sdk**");
    expect(comment).toContain("**node\\-sdk**");
    expect(comment).toContain("```sh\nnpm install @acme/sdk@npm:@acme-preview/sdk@0.0.1\n```");
    expect(comment).toContain("```sh\nnpm install @acme/node@npm:@acme-preview/node@0.0.1\n```");
  });

  it("omits install section when no install commands exist", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        diffUrl: "https://github.com/acme/ts-sdk/compare/main...fern-preview-pr-1",
      },
    ];

    const comment = formatComment(results);
    expect(comment).not.toContain("### Test install your SDK");
    expect(comment).not.toContain("```sh");
  });
});

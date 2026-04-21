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
  it("formats single successful result with install and diff", () => {
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
    // Group header always shown
    expect(comment).toContain("### ts\\-sdk");
    expect(comment).toContain("[Preview changes]");
    expect(comment).toContain(
      "```sh\nnpm install @acme/sdk@npm:@acme-preview/sdk@0.0.1-main.123 --registry https://npm.buildwithfern.com\n```"
    );
    // No table format
    expect(comment).not.toContain("| Group");
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
    expect(comment).toContain("### Errors");
    expect(comment).toContain("Docker not found");
  });

  it("omits diff link when diffUrl is missing", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install ...",
      },
    ];

    const comment = formatComment(results);
    expect(comment).not.toContain("[Preview changes]");
    // Install command still present
    expect(comment).toContain("```sh\nnpm install ...\n```");
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
    // Success group has diff + install together
    expect(comment).toContain("[Preview changes]");
    expect(comment).toContain("```sh\nnpm install ...\n```");
    // Error group in separate section
    expect(comment).toContain("### Errors");
    expect(comment).toContain("No supported generators");
  });

  it("escapes markdown special characters in error messages", () => {
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

  it("escapes markdown injection in error messages", () => {
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

  it("shows group headers when multiple successful results exist", () => {
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
    // Multiple groups: each gets its own header with diff + install
    expect(comment).toContain("### ts\\-sdk");
    expect(comment).toContain("### node\\-sdk");
    expect(comment).toContain("```sh\nnpm install @acme/sdk@npm:@acme-preview/sdk@0.0.1\n```");
    expect(comment).toContain("```sh\nnpm install @acme/node@npm:@acme-preview/node@0.0.1\n```");
  });

  it("omits code block when no install command exists", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        packageName: "@acme-preview/sdk",
        diffUrl: "https://github.com/acme/ts-sdk/compare/main...fern-preview-pr-1",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain("[Preview changes]");
    expect(comment).not.toContain("```sh");
  });
});

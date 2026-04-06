import { describe, expect, it } from "vitest";
import { formatComment } from "./post-comment.js";
import type { PreviewResult } from "./run-preview.js";

describe("formatComment", () => {
  it("formats successful results with install and diff", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        sdkRepo: "acme/ts-sdk",
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
  });

  it("formats error results", () => {
    const results: PreviewResult[] = [
      {
        status: "error",
        groupName: "ts-sdk",
        sdkRepo: undefined,
        error: "Docker not found",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain(":x: Failed");
    expect(comment).toContain("### Errors");
    expect(comment).toContain("Docker not found");
  });

  it("shows 'No changes' when diffUrl is missing", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        sdkRepo: "acme/ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install ...",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain("No changes");
  });

  it("handles mixed success and error results", () => {
    const results: PreviewResult[] = [
      {
        status: "success",
        groupName: "ts-sdk",
        sdkRepo: "acme/ts-sdk",
        packageName: "@acme-preview/sdk",
        installCommand: "npm install ...",
        diffUrl: "https://github.com/acme/ts-sdk/compare/main...fern-preview-pr-1",
      },
      {
        status: "error",
        groupName: "internal-sdk",
        sdkRepo: undefined,
        error: "No supported generators",
      },
    ];

    const comment = formatComment(results);
    expect(comment).toContain("@acme-preview/sdk");
    expect(comment).toContain(":x: Failed");
    expect(comment).toContain("No supported generators");
  });
});

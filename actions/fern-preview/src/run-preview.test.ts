import { describe, expect, it, vi } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

import { extractAutomationsJson } from "./run-preview.js";

describe("extractAutomationsJson", () => {
  it("parses clean JSON output", () => {
    const json = JSON.stringify({ results: [] }, null, 2);
    const result = extractAutomationsJson(json);
    expect(result).toEqual({ results: [] });
  });

  it("parses aggregated results with success and error entries", () => {
    const json = JSON.stringify(
      {
        results: [
          {
            groupName: "ts-sdk",
            apiName: null,
            status: "success",
            org: "acme",
            previews: [
              {
                preview_id: "abc123",
                install: "npm install @acme/sdk@npm:@acme-preview/sdk@0.0.0-preview-abc123",
                version: "0.0.0-preview-abc123",
                package_name: "@acme-preview/sdk",
                registry_url: "https://npm.buildwithfern.com",
              },
            ],
          },
          {
            groupName: "node",
            apiName: "bar",
            status: "error",
            error: "No supported generators found",
          },
        ],
      },
      null,
      2
    );
    const result = extractAutomationsJson(json);
    expect(result?.results).toHaveLength(2);
    expect(result?.results[0].status).toBe("success");
    expect(result?.results[1].status).toBe("error");
  });

  it("parses pretty-printed JSON with log lines before and after", () => {
    const stdout = `Some log line
Another log line
{
  "results": []
}
Trailing log line`;
    const result = extractAutomationsJson(stdout);
    expect(result).toEqual({ results: [] });
  });

  it("parses compact single-line JSON mixed with log lines", () => {
    const stdout = `Log line before
{"results":[]}
Log line after`;
    const result = extractAutomationsJson(stdout);
    expect(result).toEqual({ results: [] });
  });

  it("handles log lines containing braces", () => {
    const stdout = `Processing {group: ts-sdk}
{
  "results": []
}`;
    const result = extractAutomationsJson(stdout);
    expect(result).toEqual({ results: [] });
  });

  it("returns undefined for non-JSON output", () => {
    const result = extractAutomationsJson("no json here");
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty output", () => {
    const result = extractAutomationsJson("");
    expect(result).toBeUndefined();
  });

  it("rejects JSON without results array", () => {
    const json = JSON.stringify({ status: "success", previews: [] });
    const result = extractAutomationsJson(json);
    expect(result).toBeUndefined();
  });
});

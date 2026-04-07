import { describe, expect, it, vi } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

import { parseJsonFromOutput } from "./run-preview.js";

describe("parseJsonFromOutput", () => {
  it("parses clean JSON output", () => {
    const json = JSON.stringify({ status: "success", previews: [] }, null, 2);
    const result = parseJsonFromOutput(json, "test");
    expect(result).toEqual({ status: "success", previews: [] });
  });

  it("parses pretty-printed JSON with log lines before and after", () => {
    const stdout = `Some log line
Another log line
{
  "status": "success",
  "previews": []
}
Trailing log line`;
    const result = parseJsonFromOutput(stdout, "test");
    expect(result).toEqual({ status: "success", previews: [] });
  });

  it("parses compact single-line JSON mixed with log lines", () => {
    const stdout = `Log line before
{"status":"success","previews":[]}
Log line after`;
    const result = parseJsonFromOutput(stdout, "test");
    expect(result).toEqual({ status: "success", previews: [] });
  });

  it("handles log lines containing braces", () => {
    const stdout = `Processing {group: ts-sdk}
{
  "status": "success",
  "previews": []
}`;
    const result = parseJsonFromOutput(stdout, "test");
    expect(result).toEqual({ status: "success", previews: [] });
  });

  it("handles JSON with braces inside string values", () => {
    const stdout = `Log line
{
  "status": "success",
  "message": "Processed {group: ts-sdk}",
  "previews": []
}`;
    const result = parseJsonFromOutput(stdout, "test");
    expect(result).toEqual({
      status: "success",
      message: "Processed {group: ts-sdk}",
      previews: [],
    });
  });

  it("returns undefined for non-JSON output", () => {
    const result = parseJsonFromOutput("no json here", "test");
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty output", () => {
    const result = parseJsonFromOutput("", "test");
    expect(result).toBeUndefined();
  });
});

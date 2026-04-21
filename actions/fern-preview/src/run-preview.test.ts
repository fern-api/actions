import { describe, expect, it, vi } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  setSecret: vi.fn(),
}));

import { extractJsonFromOutput } from "./run-preview.js";

describe("extractJsonFromOutput", () => {
  it("parses clean JSON output", () => {
    const json = JSON.stringify({ status: "success", previews: [] }, null, 2);
    const result = extractJsonFromOutput(json);
    expect(result).toEqual({ status: "success", previews: [] });
  });

  it("parses success response with preview entries", () => {
    const json = JSON.stringify({
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
    });
    const result = extractJsonFromOutput(json);
    expect(result?.status).toBe("success");
    expect(result?.previews).toHaveLength(1);
    expect(result?.previews?.[0].preview_id).toBe("abc123");
  });

  it("parses error response", () => {
    const json = JSON.stringify({ status: "error", message: "Something went wrong" });
    const result = extractJsonFromOutput(json);
    expect(result?.status).toBe("error");
    expect(result?.message).toBe("Something went wrong");
  });

  it("extracts JSON from output with surrounding log lines", () => {
    const stdout = `Some log line
Another log line
{
  "status": "success",
  "previews": []
}
Trailing log line`;
    const result = extractJsonFromOutput(stdout);
    expect(result).toEqual({ status: "success", previews: [] });
  });

  it("returns undefined for non-JSON output", () => {
    const result = extractJsonFromOutput("no json here");
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty output", () => {
    const result = extractJsonFromOutput("");
    expect(result).toBeUndefined();
  });

  it("rejects JSON without status field", () => {
    const json = JSON.stringify({ previews: [], org: "acme" });
    const result = extractJsonFromOutput(json);
    expect(result).toBeUndefined();
  });
});

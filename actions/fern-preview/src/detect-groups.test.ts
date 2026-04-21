import { describe, expect, it } from "vitest";
import { parseGroupsJson } from "./detect-groups.js";

describe("parseGroupsJson", () => {
  it("parses a valid JSON array", () => {
    const output = JSON.stringify([
      { groupName: "ts-sdk", apiName: null, generator: "fernapi/fern-typescript-sdk" },
    ]);
    expect(parseGroupsJson(output)).toEqual([{ groupName: "ts-sdk", apiName: undefined }]);
  });

  it("parses multiple entries", () => {
    const output = JSON.stringify([
      { groupName: "ts-sdk", apiName: null, generator: "fernapi/fern-typescript-sdk" },
      { groupName: "node", apiName: "payments", generator: "fernapi/fern-typescript-node-sdk" },
    ]);
    const result = parseGroupsJson(output);
    expect(result).toEqual([
      { groupName: "ts-sdk", apiName: undefined },
      { groupName: "node", apiName: "payments" },
    ]);
  });

  it("converts null apiName to undefined", () => {
    const output = JSON.stringify([
      { groupName: "sdk", apiName: null, generator: "fernapi/fern-typescript-sdk" },
    ]);
    const result = parseGroupsJson(output);
    expect(result?.[0]?.apiName).toBeUndefined();
  });

  it("preserves string apiName", () => {
    const output = JSON.stringify([
      { groupName: "sdk", apiName: "bar", generator: "fernapi/fern-typescript-node-sdk" },
    ]);
    const result = parseGroupsJson(output);
    expect(result?.[0]?.apiName).toBe("bar");
  });

  it("returns empty array for empty JSON array", () => {
    expect(parseGroupsJson("[]")).toEqual([]);
  });

  it("returns undefined for empty string", () => {
    expect(parseGroupsJson("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(parseGroupsJson("   \n  ")).toBeUndefined();
  });

  it("returns undefined for non-array JSON (object)", () => {
    expect(parseGroupsJson('{"status":"ok"}')).toBeUndefined();
  });

  it("returns undefined for non-array JSON (string)", () => {
    expect(parseGroupsJson('"hello"')).toBeUndefined();
  });

  it("returns undefined for completely invalid JSON", () => {
    expect(parseGroupsJson("not json at all")).toBeUndefined();
  });

  it("extracts JSON array from output with surrounding log lines", () => {
    const json = JSON.stringify([
      { groupName: "ts-sdk", apiName: null, generator: "fernapi/fern-typescript-sdk" },
    ]);
    const output = `Some log line\nAnother log line\n${json}\nTrailing log`;
    const result = parseGroupsJson(output);
    expect(result).toEqual([{ groupName: "ts-sdk", apiName: undefined }]);
  });

  it("handles pretty-printed JSON array", () => {
    const json = JSON.stringify(
      [{ groupName: "ts-sdk", apiName: null, generator: "fernapi/fern-typescript-sdk" }],
      null,
      2
    );
    const result = parseGroupsJson(json);
    expect(result).toEqual([{ groupName: "ts-sdk", apiName: undefined }]);
  });
});

import { describe, expect, it } from "vitest";
import { extractUpgradeJson } from "../src/run-upgrade.js";

describe("extractUpgradeJson", () => {
  it("parses clean JSON output", () => {
    const json = JSON.stringify({
      cli: { from: "4.66.0", to: "5.7.3", upgraded: true },
      generators: [
        {
          name: "fernapi/fern-go-sdk",
          group: "go-sdk",
          api: "api",
          from: "0.28.0",
          to: "1.37.0",
          changelog: "https://buildwithfern.com/learn/sdks/generators/go/changelog",
          migrationsApplied: 1,
        },
      ],
      skippedMajor: [],
      alreadyUpToDate: [],
    });

    const result = extractUpgradeJson(json);
    expect(result).toBeDefined();
    expect(result?.cli.upgraded).toBe(true);
    expect(result?.generators).toHaveLength(1);
  });

  it("extracts JSON from output with log lines mixed in", () => {
    const output = [
      "Running CLI upgrade...",
      "CLI upgraded: 4.66.0 -> 5.7.3",
      '{"cli":{"from":"4.66.0","to":"5.7.3","upgraded":true},"generators":[],"skippedMajor":[],"alreadyUpToDate":[]}',
    ].join("\n");

    const result = extractUpgradeJson(output);
    expect(result).toBeDefined();
    expect(result?.cli.from).toBe("4.66.0");
  });

  it("returns undefined for empty output", () => {
    expect(extractUpgradeJson("")).toBeUndefined();
    expect(extractUpgradeJson("  ")).toBeUndefined();
  });

  it("returns undefined for non-JSON output", () => {
    expect(extractUpgradeJson("just some log messages\nnothing here")).toBeUndefined();
  });

  it("returns undefined for JSON without expected fields", () => {
    expect(extractUpgradeJson('{"unrelated": true}')).toBeUndefined();
  });

  it("handles multi-line JSON output", () => {
    const output = `some log line
{
  "cli": { "from": "5.0.0", "to": "5.7.3", "upgraded": true },
  "generators": [],
  "skippedMajor": [],
  "alreadyUpToDate": []
}`;

    const result = extractUpgradeJson(output);
    expect(result).toBeDefined();
    expect(result?.cli.upgraded).toBe(true);
  });
});

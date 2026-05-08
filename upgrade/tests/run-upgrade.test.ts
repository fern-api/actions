import { describe, expect, it } from "vitest";
import { type AutomationsUpgradeJson, parseUpgradeOutput } from "../src/run-upgrade.js";

describe("parseUpgradeOutput", () => {
  const VALID_JSON: AutomationsUpgradeJson = {
    cli: { from: "4.66.0", to: "5.19.0", upgraded: true },
    generators: [
      {
        name: "fernapi/fern-typescript-sdk",
        group: "ts-sdk",
        api: "api",
        from: "3.63.4",
        to: "3.70.0",
        changelog: "https://buildwithfern.com/learn/sdks/generators/typescript/changelog",
        migrationsApplied: 0,
      },
    ],
    skippedMajor: [],
    alreadyUpToDate: [],
    pr: {
      title: "chore(fern): upgrade CLI 4.66.0 → 5.19.0 and 1 generator",
      body: "## Fern Upgrade\n...",
      commitMessage: "chore: upgrade fern cli 4.66.0 -> 5.19.0, typescript-sdk 3.63.4 -> 3.70.0",
    },
  };

  it("parses valid JSON output", () => {
    const result = parseUpgradeOutput(JSON.stringify(VALID_JSON));
    expect(result.cli.from).toBe("4.66.0");
    expect(result.cli.to).toBe("5.19.0");
    expect(result.generators).toHaveLength(1);
    expect(result.pr?.title).toContain("CLI 4.66.0");
  });

  it("handles leading/trailing whitespace", () => {
    const result = parseUpgradeOutput(`  \n${JSON.stringify(VALID_JSON)}\n  `);
    expect(result.cli.upgraded).toBe(true);
  });

  it("throws on empty stdout", () => {
    expect(() => parseUpgradeOutput("")).toThrow("no JSON output");
  });

  it("throws on whitespace-only stdout", () => {
    expect(() => parseUpgradeOutput("  \n  ")).toThrow("no JSON output");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseUpgradeOutput("not json {")).toThrow("invalid JSON");
  });

  it("throws on truncated JSON", () => {
    expect(() => parseUpgradeOutput('{"cli": {')).toThrow("invalid JSON");
  });

  it("throws when cli field is missing", () => {
    expect(() => parseUpgradeOutput(JSON.stringify({ generators: [], pr: null }))).toThrow(
      "unexpected JSON schema"
    );
  });

  it("throws when generators field is missing", () => {
    expect(() =>
      parseUpgradeOutput(
        JSON.stringify({ cli: { from: "1.0.0", to: "2.0.0", upgraded: true }, pr: null })
      )
    ).toThrow("unexpected JSON schema");
  });

  it("throws when generators is not an array", () => {
    expect(() =>
      parseUpgradeOutput(
        JSON.stringify({
          cli: { from: "1.0.0", to: "2.0.0", upgraded: true },
          generators: "not-array",
          pr: null,
        })
      )
    ).toThrow("unexpected JSON schema");
  });

  it("accepts pr: null (no upgrades available)", () => {
    const noChanges = {
      cli: { from: "5.19.0", to: "5.19.0", upgraded: false },
      generators: [],
      skippedMajor: [],
      alreadyUpToDate: [],
      pr: null,
    };
    const result = parseUpgradeOutput(JSON.stringify(noChanges));
    expect(result.pr).toBeNull();
    expect(result.cli.upgraded).toBe(false);
  });

  it("throws when pr is present but missing sub-fields", () => {
    const missingBody = {
      cli: { from: "4.66.0", to: "5.19.0", upgraded: true },
      generators: [],
      skippedMajor: [],
      alreadyUpToDate: [],
      pr: { title: "chore: upgrade" },
    };
    expect(() => parseUpgradeOutput(JSON.stringify(missingBody))).toThrow("missing fields");
  });

  it("throws when pr has empty title", () => {
    const emptyTitle = {
      cli: { from: "4.66.0", to: "5.19.0", upgraded: true },
      generators: [],
      skippedMajor: [],
      alreadyUpToDate: [],
      pr: { title: "", body: "## Upgrade", commitMessage: "chore: upgrade" },
    };
    expect(() => parseUpgradeOutput(JSON.stringify(emptyTitle))).toThrow("missing fields");
  });
});

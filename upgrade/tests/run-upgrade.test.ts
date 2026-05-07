import { describe, expect, it } from "vitest";
import type { AutomationsUpgradeJson } from "../src/run-upgrade.js";

describe("AutomationsUpgradeJson schema", () => {
  it("accepts a complete upgrade result with pr suggestion", () => {
    const json: AutomationsUpgradeJson = {
      schemaVersion: 1,
      cli: { from: "4.66.0", to: "5.7.3", upgraded: true },
      generators: [
        {
          name: "fernapi/fern-typescript-sdk",
          group: "ts-sdk",
          api: "api",
          from: "3.63.4",
          to: "3.65.5",
          changelog: "https://buildwithfern.com/learn/sdks/generators/typescript/changelog",
          migrationsApplied: 1,
        },
      ],
      skippedMajor: [{ name: "fernapi/fern-ruby-sdk-v2", current: "0.3.0", latest: "1.0.0" }],
      alreadyUpToDate: [{ name: "fernapi/fern-go-sdk", version: "1.37.0" }],
      pr: {
        title: "chore(fern): upgrade CLI 4.66.0 → 5.7.3 and 1 generator",
        body: "## Fern Upgrade\n...",
        commitMessage: "chore: upgrade fern cli 4.66.0 -> 5.7.3, typescript-sdk 3.63.4 -> 3.65.5",
      },
    };

    expect(json.cli.upgraded).toBe(true);
    expect(json.generators).toHaveLength(1);
    expect(json.pr).not.toBeNull();
    expect(json.pr?.title).toContain("CLI 4.66.0");
  });

  it("accepts null pr when nothing changed", () => {
    const json: AutomationsUpgradeJson = {
      schemaVersion: 1,
      cli: { from: "5.7.3", to: "5.7.3", upgraded: false },
      generators: [],
      skippedMajor: [],
      alreadyUpToDate: [{ name: "fernapi/fern-go-sdk", version: "1.37.0" }],
      pr: null,
    };

    expect(json.cli.upgraded).toBe(false);
    expect(json.generators).toHaveLength(0);
    expect(json.pr).toBeNull();
  });

  it("validates generators have expected fields", () => {
    const json: AutomationsUpgradeJson = {
      schemaVersion: 1,
      cli: { from: "5.0.0", to: "5.7.3", upgraded: true },
      generators: [
        {
          name: "fernapi/fern-python-sdk",
          group: "python-sdk",
          api: null,
          from: "4.3.0",
          to: "5.9.1",
          changelog: undefined,
          migrationsApplied: 0,
        },
      ],
      skippedMajor: [],
      alreadyUpToDate: [],
      pr: {
        title: "chore(fern): upgrade CLI 5.0.0 → 5.7.3 and 1 generator",
        body: "## Fern Upgrade\n...",
        commitMessage: "chore: upgrade fern cli 5.0.0 -> 5.7.3, python-sdk 4.3.0 -> 5.9.1",
      },
    };

    const gen = json.generators[0];
    expect(gen.api).toBeNull();
    expect(gen.changelog).toBeUndefined();
    expect(gen.migrationsApplied).toBe(0);
  });
});

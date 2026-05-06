import { describe, expect, it } from "vitest";
import {
  buildCommitMessage,
  buildPrBody,
  buildPrTitle,
  cliJsonToDiff,
  getChangelogUrl,
  getShortGeneratorName,
} from "../src/diff.js";
import type { AutomationsUpgradeJson } from "../src/run-upgrade.js";

describe("cliJsonToDiff", () => {
  it("converts CLI JSON to internal diff format", () => {
    const json: AutomationsUpgradeJson = {
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
      skippedMajor: [],
      alreadyUpToDate: [],
    };

    const diff = cliJsonToDiff(json);
    expect(diff.cliFrom).toBe("4.66.0");
    expect(diff.cliTo).toBe("5.7.3");
    expect(diff.cliUpgraded).toBe(true);
    expect(diff.generators).toHaveLength(1);
    expect(diff.generators[0].name).toBe("fernapi/fern-typescript-sdk");
  });

  it("handles no upgrades", () => {
    const json: AutomationsUpgradeJson = {
      cli: { from: "5.7.3", to: "5.7.3", upgraded: false },
      generators: [],
      skippedMajor: [],
      alreadyUpToDate: [{ name: "fernapi/fern-go-sdk", version: "1.37.0" }],
    };

    const diff = cliJsonToDiff(json);
    expect(diff.cliUpgraded).toBe(false);
    expect(diff.generators).toHaveLength(0);
  });

  it("handles multi-API upgrades with null api field", () => {
    const json: AutomationsUpgradeJson = {
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
    };

    const diff = cliJsonToDiff(json);
    expect(diff.generators[0].api).toBeNull();
  });
});

describe("getShortGeneratorName", () => {
  it("strips fernapi/fern- prefix", () => {
    expect(getShortGeneratorName("fernapi/fern-typescript-sdk")).toBe("typescript-sdk");
    expect(getShortGeneratorName("fernapi/fern-python-sdk")).toBe("python-sdk");
    expect(getShortGeneratorName("fernapi/fern-go-sdk")).toBe("go-sdk");
  });

  it("passes through names without the prefix", () => {
    expect(getShortGeneratorName("other-generator")).toBe("other-generator");
  });
});

describe("getChangelogUrl", () => {
  it("derives URL from standard generator names", () => {
    expect(getChangelogUrl("fernapi/fern-typescript-sdk")).toBe(
      "https://buildwithfern.com/learn/sdks/generators/typescript/changelog"
    );
    expect(getChangelogUrl("fernapi/fern-python-sdk")).toBe(
      "https://buildwithfern.com/learn/sdks/generators/python/changelog"
    );
    expect(getChangelogUrl("fernapi/fern-go-sdk")).toBe(
      "https://buildwithfern.com/learn/sdks/generators/go/changelog"
    );
  });

  it("handles variant names (typescript-node-sdk, ruby-sdk-v2)", () => {
    expect(getChangelogUrl("fernapi/fern-typescript-node-sdk")).toBe(
      "https://buildwithfern.com/learn/sdks/generators/typescript/changelog"
    );
    expect(getChangelogUrl("fernapi/fern-ruby-sdk-v2")).toBe(
      "https://buildwithfern.com/learn/sdks/generators/ruby/changelog"
    );
  });

  it("returns undefined for unrecognized names", () => {
    expect(getChangelogUrl("some-other-generator")).toBeUndefined();
    expect(getChangelogUrl("")).toBeUndefined();
  });
});

describe("buildPrTitle", () => {
  it("includes CLI and generator count", () => {
    const title = buildPrTitle({
      cliFrom: "4.66.0",
      cliTo: "5.7.3",
      cliUpgraded: true,
      generators: [
        {
          name: "fernapi/fern-typescript-sdk",
          group: "ts",
          api: null,
          from: "3.63.4",
          to: "3.65.5",
          changelog: undefined,
          migrationsApplied: 0,
        },
        {
          name: "fernapi/fern-python-sdk",
          group: "py",
          api: null,
          from: "4.3.0",
          to: "5.9.1",
          changelog: undefined,
          migrationsApplied: 0,
        },
      ],
    });
    expect(title).toBe("chore(fern): upgrade CLI 4.66.0 → 5.7.3 and 2 generators");
  });

  it("handles CLI-only upgrade", () => {
    const title = buildPrTitle({
      cliFrom: "4.66.0",
      cliTo: "5.7.3",
      cliUpgraded: true,
      generators: [],
    });
    expect(title).toBe("chore(fern): upgrade CLI 4.66.0 → 5.7.3");
  });

  it("handles generators-only upgrade", () => {
    const title = buildPrTitle({
      cliFrom: "5.7.3",
      cliTo: "5.7.3",
      cliUpgraded: false,
      generators: [
        {
          name: "fernapi/fern-go-sdk",
          group: "go",
          api: null,
          from: "0.28.0",
          to: "1.37.0",
          changelog: undefined,
          migrationsApplied: 0,
        },
      ],
    });
    expect(title).toBe("chore(fern): upgrade 1 generator");
  });

  it("uses singular for one generator", () => {
    const title = buildPrTitle({
      cliFrom: "5.0.0",
      cliTo: "5.7.3",
      cliUpgraded: true,
      generators: [
        {
          name: "fernapi/fern-go-sdk",
          group: "go",
          api: null,
          from: "0.28.0",
          to: "1.37.0",
          changelog: undefined,
          migrationsApplied: 0,
        },
      ],
    });
    expect(title).toContain("1 generator");
    expect(title).not.toContain("1 generators");
  });
});

describe("buildPrBody", () => {
  it("includes CLI and generator table", () => {
    const body = buildPrBody({
      cliFrom: "4.66.0",
      cliTo: "5.7.3",
      cliUpgraded: true,
      generators: [
        {
          name: "fernapi/fern-typescript-sdk",
          group: "ts-sdk",
          api: "api",
          from: "3.63.4",
          to: "3.65.5",
          changelog: "https://buildwithfern.com/learn/sdks/generators/typescript/changelog",
          migrationsApplied: 0,
        },
      ],
    });
    expect(body).toContain("## Fern Upgrade");
    expect(body).toContain("`4.66.0` → `5.7.3`");
    expect(body).toContain("| fernapi/fern-typescript-sdk |");
    expect(body).toContain(
      "[View](https://buildwithfern.com/learn/sdks/generators/typescript/changelog)"
    );
    expect(body).toContain("fern-upgrade");
  });

  it("uses fallback changelog URL when CLI doesn't provide one", () => {
    const body = buildPrBody({
      cliFrom: "5.0.0",
      cliTo: "5.0.0",
      cliUpgraded: false,
      generators: [
        {
          name: "fernapi/fern-go-sdk",
          group: "go-sdk",
          api: null,
          from: "0.28.0",
          to: "1.37.0",
          changelog: undefined,
          migrationsApplied: 0,
        },
      ],
    });
    expect(body).toContain("[View](https://buildwithfern.com/learn/sdks/generators/go/changelog)");
  });
});

describe("buildCommitMessage", () => {
  it("includes all version changes", () => {
    const msg = buildCommitMessage({
      cliFrom: "4.66.0",
      cliTo: "5.7.3",
      cliUpgraded: true,
      generators: [
        {
          name: "fernapi/fern-typescript-sdk",
          group: "ts",
          api: null,
          from: "3.63.4",
          to: "3.65.5",
          changelog: undefined,
          migrationsApplied: 0,
        },
        {
          name: "fernapi/fern-python-sdk",
          group: "py",
          api: null,
          from: "4.3.0",
          to: "5.9.1",
          changelog: undefined,
          migrationsApplied: 0,
        },
      ],
    });
    expect(msg).toContain("cli 4.66.0 → 5.7.3");
    expect(msg).toContain("typescript-sdk 3.63.4 → 3.65.5");
    expect(msg).toContain("python-sdk 4.3.0 → 5.9.1");
  });

  it("handles no changes", () => {
    const msg = buildCommitMessage({
      cliFrom: "5.7.3",
      cliTo: "5.7.3",
      cliUpgraded: false,
      generators: [],
    });
    expect(msg).toContain("no changes");
  });
});

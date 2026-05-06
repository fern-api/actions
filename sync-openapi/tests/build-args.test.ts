import { describe, expect, it } from "vitest";
import { buildPullSpecArgs, buildSyncSpecsArgs } from "../src/build-args.js";

describe("buildPullSpecArgs", () => {
  it("includes --token always", () => {
    expect(buildPullSpecArgs({ token: "ghp_xyz", autoMerge: false })).toEqual([
      "--token",
      "ghp_xyz",
    ]);
  });

  it("includes --branch when set", () => {
    expect(buildPullSpecArgs({ token: "t", branch: "fern/pull-spec", autoMerge: false })).toEqual([
      "--token",
      "t",
      "--branch",
      "fern/pull-spec",
    ]);
  });

  it("includes --auto-merge when true", () => {
    expect(buildPullSpecArgs({ token: "t", autoMerge: true })).toEqual([
      "--token",
      "t",
      "--auto-merge",
    ]);
  });

  it("emits all flags in stable order", () => {
    expect(buildPullSpecArgs({ token: "t", branch: "b", autoMerge: true })).toEqual([
      "--token",
      "t",
      "--branch",
      "b",
      "--auto-merge",
    ]);
  });

  it("treats empty branch as not-set", () => {
    expect(buildPullSpecArgs({ token: "t", branch: "", autoMerge: false })).toEqual([
      "--token",
      "t",
    ]);
  });
});

describe("buildSyncSpecsArgs", () => {
  it("requires repository", () => {
    expect(() => buildSyncSpecsArgs({ token: "t", autoMerge: false, sources: "[]" })).toThrow(
      /'repository' input is required/
    );
  });

  it("requires sources", () => {
    expect(() =>
      buildSyncSpecsArgs({ token: "t", autoMerge: false, repository: "owner/repo" })
    ).toThrow(/'sources' input is required/);
  });

  it("emits the minimum set of flags when repository and sources are provided", () => {
    expect(
      buildSyncSpecsArgs({ token: "t", repository: "owner/repo", sources: "[]", autoMerge: false })
    ).toEqual(["--repository", "owner/repo", "--sources", "[]", "--token", "t"]);
  });

  it("includes --branch and --auto-merge when set", () => {
    expect(
      buildSyncSpecsArgs({
        token: "t",
        repository: "owner/repo",
        sources: "[]",
        branch: "fern/sync-specs",
        autoMerge: true,
      })
    ).toEqual([
      "--repository",
      "owner/repo",
      "--sources",
      "[]",
      "--token",
      "t",
      "--branch",
      "fern/sync-specs",
      "--auto-merge",
    ]);
  });

  it("treats empty repository/sources as missing and throws", () => {
    expect(() =>
      buildSyncSpecsArgs({ token: "t", repository: "", sources: "[]", autoMerge: false })
    ).toThrow(/'repository' input is required/);
    expect(() =>
      buildSyncSpecsArgs({ token: "t", repository: "owner/repo", sources: "", autoMerge: false })
    ).toThrow(/'sources' input is required/);
  });
});

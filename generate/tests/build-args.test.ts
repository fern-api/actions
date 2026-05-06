import { describe, expect, it } from "vitest";
import { buildGenerateArgs } from "../src/build-args.js";

describe("buildGenerateArgs", () => {
  it("returns no args when nothing is set", () => {
    expect(buildGenerateArgs({ autoMerge: false })).toEqual([]);
  });

  it("includes --auto-merge only when true", () => {
    expect(buildGenerateArgs({ autoMerge: true })).toEqual(["--auto-merge"]);
    expect(buildGenerateArgs({ autoMerge: false })).toEqual([]);
  });

  it("includes --group when set", () => {
    expect(buildGenerateArgs({ autoMerge: false, group: "python" })).toEqual(["--group", "python"]);
  });

  it("includes --api when set", () => {
    expect(buildGenerateArgs({ autoMerge: false, api: "myapi" })).toEqual(["--api", "myapi"]);
  });

  it("includes --generator when set", () => {
    expect(buildGenerateArgs({ autoMerge: false, generator: "0" })).toEqual(["--generator", "0"]);
    expect(buildGenerateArgs({ autoMerge: false, generator: "fernapi/fern-python-sdk" })).toEqual([
      "--generator",
      "fernapi/fern-python-sdk",
    ]);
  });

  it("includes --version when set", () => {
    expect(buildGenerateArgs({ autoMerge: false, version: "AUTO" })).toEqual(["--version", "AUTO"]);
    expect(buildGenerateArgs({ autoMerge: false, version: "1.2.3" })).toEqual([
      "--version",
      "1.2.3",
    ]);
  });

  it("emits flags in a stable order: group, api, generator, version, auto-merge", () => {
    expect(
      buildGenerateArgs({
        autoMerge: true,
        group: "g",
        api: "a",
        generator: "0",
        version: "AUTO",
      })
    ).toEqual([
      "--group",
      "g",
      "--api",
      "a",
      "--generator",
      "0",
      "--version",
      "AUTO",
      "--auto-merge",
    ]);
  });

  it("treats empty strings as not-set (no flag emitted)", () => {
    expect(
      buildGenerateArgs({
        autoMerge: false,
        group: "",
        api: "",
        generator: "",
        version: "",
      })
    ).toEqual([]);
  });
});

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @actions/core before importing the module under test
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

import { detectPreviewGroups } from "./detect-groups.js";

let tmpDir: string;

function writeGeneratorsYml(relativePath: string, content: string): void {
  const fullPath = path.join(tmpDir, "fern", relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-detect-groups-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("detectPreviewGroups", () => {
  it("detects ts-sdk group from single generators.yml", () => {
    writeGeneratorsYml(
      "generators.yml",
      `
groups:
  ts-sdk:
    generators:
      - name: fern-typescript-sdk
        version: "3.48.0"
        github:
          repository: acme/ts-sdk
          mode: push
`
    );

    const groups = detectPreviewGroups();
    expect(groups).toEqual([{ groupName: "ts-sdk", apiName: undefined, sdkRepo: "acme/ts-sdk" }]);
  });

  it("detects groups from multi-api layout", () => {
    writeGeneratorsYml(
      "apis/bar/generators.yml",
      `
groups:
  ts-sdk:
    generators:
      - name: fernapi/fern-typescript-node-sdk
        version: "0.9.5"
        github:
          repository: acme/bar-ts-sdk
`
    );

    const groups = detectPreviewGroups();
    expect(groups).toEqual([{ groupName: "ts-sdk", apiName: "bar", sdkRepo: "acme/bar-ts-sdk" }]);
  });

  it("skips non-TypeScript generators", () => {
    writeGeneratorsYml(
      "generators.yml",
      `
groups:
  python-sdk:
    generators:
      - name: fernapi/fern-python-sdk
        version: "4.0.0"
`
    );

    const groups = detectPreviewGroups();
    expect(groups).toEqual([]);
  });

  it("returns empty array when no fern/ directory exists", () => {
    const groups = detectPreviewGroups();
    expect(groups).toEqual([]);
  });

  it("handles generators without github config", () => {
    writeGeneratorsYml(
      "generators.yml",
      `
groups:
  internal:
    generators:
      - name: fernapi/fern-typescript-node-sdk
        version: "0.9.5"
        output:
          location: local-file-system
          path: ./out
`
    );

    const groups = detectPreviewGroups();
    expect(groups).toEqual([{ groupName: "internal", apiName: undefined, sdkRepo: undefined }]);
  });

  it("handles malformed YAML gracefully", () => {
    writeGeneratorsYml("generators.yml", "{ invalid yaml: [unterminated");

    const groups = detectPreviewGroups();
    expect(groups).toEqual([]);
  });

  it("matches all supported TypeScript generator names", () => {
    writeGeneratorsYml(
      "generators.yml",
      `
groups:
  node:
    generators:
      - name: fern-typescript-node-sdk
        version: "1.0.0"
  browser:
    generators:
      - name: fernapi/fern-typescript-browser-sdk
        version: "1.0.0"
  unified:
    generators:
      - name: fern-typescript-sdk
        version: "1.0.0"
`
    );

    const groups = detectPreviewGroups();
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.groupName)).toEqual(["node", "browser", "unified"]);
  });

  it("returns all supported generators when filter is 'all'", () => {
    writeGeneratorsYml(
      "generators.yml",
      `
groups:
  node:
    generators:
      - name: fern-typescript-node-sdk
        version: "1.0.0"
  browser:
    generators:
      - name: fernapi/fern-typescript-browser-sdk
        version: "1.0.0"
`
    );

    const groups = detectPreviewGroups({ generators: "all" });
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.groupName)).toEqual(["node", "browser"]);
  });
});

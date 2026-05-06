import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectConfig } from "./project-config.js";

function makeIsolatedTempCwd(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fern-actions-project-config-test-"));
}

describe("ProjectConfig.tryLoad", () => {
  let originalCwd: string;
  let tmpCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpCwd = makeIsolatedTempCwd();
    process.chdir(tmpCwd);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpCwd, { recursive: true, force: true });
  });

  it("loads organization and version from fern/fern.config.json in cwd", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    fs.writeFileSync(
      path.join(tmpCwd, "fern", "fern.config.json"),
      JSON.stringify({ organization: "square-bank", version: "0.42.0" })
    );

    const config = ProjectConfig.tryLoad();
    expect(config).toBeDefined();
    expect(config?.organization).toBe("square-bank");
    expect(config?.version).toBe("0.42.0");
    expect(config?.absolutePath).toBe(
      path.join(fs.realpathSync(tmpCwd), "fern", "fern.config.json")
    );
    expect(config?.rawConfig).toEqual({ organization: "square-bank", version: "0.42.0" });
  });

  it("walks up from cwd to locate fern/fern.config.json in an ancestor", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    fs.writeFileSync(
      path.join(tmpCwd, "fern", "fern.config.json"),
      JSON.stringify({ organization: "acme", version: "1.0.0" })
    );
    const nested = path.join(tmpCwd, "subdir", "deeper");
    fs.mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    expect(ProjectConfig.tryLoad()?.organization).toBe("acme");
  });

  it("returns undefined when no fern/ ancestor exists", () => {
    expect(ProjectConfig.tryLoad()).toBeUndefined();
  });

  it("returns undefined when fern/ exists but fern.config.json is missing", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    expect(ProjectConfig.tryLoad()).toBeUndefined();
  });

  it("returns undefined when fern.config.json is unreadable JSON", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    fs.writeFileSync(path.join(tmpCwd, "fern", "fern.config.json"), "not json {");
    expect(ProjectConfig.tryLoad()).toBeUndefined();
  });

  it("returns undefined when the parsed shape is missing organization", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    fs.writeFileSync(
      path.join(tmpCwd, "fern", "fern.config.json"),
      JSON.stringify({ version: "0.0.1" })
    );
    expect(ProjectConfig.tryLoad()).toBeUndefined();
  });

  it("returns undefined when the parsed shape is missing version", () => {
    fs.mkdirSync(path.join(tmpCwd, "fern"));
    fs.writeFileSync(
      path.join(tmpCwd, "fern", "fern.config.json"),
      JSON.stringify({ organization: "acme" })
    );
    expect(ProjectConfig.tryLoad()).toBeUndefined();
  });
});

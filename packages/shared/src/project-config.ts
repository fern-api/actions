import * as fs from "node:fs";
import * as path from "node:path";
import findUp from "find-up";

const FERN_DIRECTORY = "fern";
const PROJECT_CONFIG_FILENAME = "fern.config.json";

/**
 * Raw on-disk shape of `fern.config.json`. Mirrors `ProjectConfigSchema` in
 * `@fern-api/configuration` (the CLI's strict zod schema).
 */
export interface ProjectConfigSchema {
  organization: string;
  version: string;
}

/**
 * In-memory representation of the customer's `fern.config.json`. Mirrors the
 * CLI's `ProjectConfig` interface and its loader (`getFernDirectory` +
 * `loadProjectConfig`), so the wrapper resolves the same `organization` and
 * `version` the CLI itself sees.
 *
 * Synchronous and best-effort: `tryLoad` returns `undefined` rather than
 * throwing when the file is missing or malformed, since the wrapper uses
 * this for telemetry enrichment, not as a hard pre-flight check.
 */
export class ProjectConfig {
  readonly absolutePath: string;
  readonly rawConfig: ProjectConfigSchema;
  readonly organization: string;
  readonly version: string;

  private constructor(absolutePath: string, rawConfig: ProjectConfigSchema) {
    this.absolutePath = absolutePath;
    this.rawConfig = rawConfig;
    this.organization = rawConfig.organization;
    this.version = rawConfig.version;
  }

  /**
   * Walks up from cwd to the first ancestor containing a `fern/` directory,
   * then reads `fern.config.json` from inside it. Returns `undefined` when no
   * `fern/` ancestor exists, the config file is missing, JSON parsing fails,
   * or the parsed value doesn't match `ProjectConfigSchema`.
   */
  static tryLoad(): ProjectConfig | undefined {
    const fernDir = findUp.sync(FERN_DIRECTORY, { type: "directory" });
    if (fernDir == null) {
      return undefined;
    }
    const configPath = path.join(fernDir, PROJECT_CONFIG_FILENAME);
    if (!findUp.sync.exists(configPath)) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
      if (!isProjectConfigSchema(parsed)) {
        return undefined;
      }
      return new ProjectConfig(configPath, parsed);
    } catch {
      return undefined;
    }
  }
}

function isProjectConfigSchema(value: unknown): value is ProjectConfigSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { organization?: unknown }).organization === "string" &&
    typeof (value as { version?: unknown }).version === "string"
  );
}

import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as yaml from "js-yaml";

export interface DetectedGroup {
  groupName: string;
  apiName: string | undefined;
  sdkRepo: string | undefined;
}

const TS_GENERATOR_PATTERN = /^(fernapi\/)?fern-typescript-(node-sdk|browser-sdk|sdk)$/;

export async function detectTypeScriptGroups(): Promise<DetectedGroup[]> {
  const results: DetectedGroup[] = [];
  const fernDir = path.resolve("fern");

  if (!fs.existsSync(fernDir)) {
    core.warning("No fern/ directory found in the repository root.");
    return results;
  }

  const generatorsFiles = findGeneratorsYml(fernDir);
  core.info(`Found ${generatorsFiles.length} generators.yml file(s)`);

  for (const filePath of generatorsFiles) {
    let config: Record<string, unknown> | null;
    try {
      const content = fs.readFileSync(filePath, "utf8");
      config = yaml.load(content) as Record<string, unknown> | null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Failed to parse ${filePath}: ${message}`);
      continue;
    }
    if (config == null) {
      continue;
    }

    const groups = (config.groups ?? {}) as Record<string, unknown>;

    // Determine API name from path: fern/apis/<name>/generators.yml → <name>
    const relative = path.relative(fernDir, filePath);
    const apiMatch = relative.match(/^apis\/([^/]+)\//);
    const apiName = apiMatch?.[1];

    for (const [groupName, groupConfig] of Object.entries(groups)) {
      const groupObj = groupConfig as Record<string, unknown> | null;
      if (groupObj == null) {
        continue;
      }
      const generators = groupObj.generators as Array<Record<string, unknown>> | undefined;
      if (!generators) {
        continue;
      }

      for (const gen of generators) {
        const name = gen.name as string;
        if (TS_GENERATOR_PATTERN.test(name)) {
          const githubConfig = gen.github as Record<string, string> | undefined;
          results.push({
            groupName,
            apiName,
            sdkRepo: githubConfig?.repository,
          });
          break; // One TS match per group is enough
        }
      }
    }
  }

  return results;
}

// Max depth for recursive walk (fern/ → apis/<name>/ → generators.yml = 3 levels)
const MAX_WALK_DEPTH = 5;

function findGeneratorsYml(dir: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string, depth: number): void {
    if (depth > MAX_WALK_DEPTH) {
      return;
    }
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name === "generators.yml") {
        results.push(fullPath);
      }
    }
  }

  walk(dir, 0);
  return results;
}

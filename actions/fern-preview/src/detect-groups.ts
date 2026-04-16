import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as yaml from "js-yaml";

export interface DetectedGroup {
  groupName: string;
  apiName: string | undefined;
}

const GENERATOR_PATTERNS: Record<string, RegExp> = {
  typescript: /^(fernapi\/)?fern-typescript-(node-sdk|browser-sdk|sdk)$/,
  // Future languages:
  // python: /^(fernapi\/)?fern-python-sdk$/,
  // java: /^(fernapi\/)?fern-java-sdk$/,
  // go: /^(fernapi\/)?fern-go-sdk$/,
};

export function detectPreviewGroups({
  generators = "typescript",
}: {
  generators?: keyof typeof GENERATOR_PATTERNS | "all";
} = {}): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  const patterns =
    generators === "all" ? Object.values(GENERATOR_PATTERNS) : [GENERATOR_PATTERNS[generators]];
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
      const groupGenerators = groupObj.generators as Array<Record<string, unknown>> | undefined;
      if (!groupGenerators) {
        continue;
      }

      for (const gen of groupGenerators) {
        const name = gen.name as string;
        if (patterns.some((p) => p?.test(name))) {
          results.push({
            groupName,
            apiName,
          });
          break; // One match per group is enough
        }
      }
    }
  }

  return results;
}

function findGeneratorsYml(fernDir: string): string[] {
  const results: string[] = [];

  // Single-API layout: fern/generators.yml
  const rootGenerators = path.join(fernDir, "generators.yml");
  if (fs.existsSync(rootGenerators)) {
    results.push(rootGenerators);
  }

  // Multi-API layout: fern/apis/<name>/generators.yml
  const apisDir = path.join(fernDir, "apis");
  if (fs.existsSync(apisDir)) {
    for (const entry of fs.readdirSync(apisDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const apiGenerators = path.join(apisDir, entry.name, "generators.yml");
        if (fs.existsSync(apiGenerators)) {
          results.push(apiGenerators);
        }
      }
    }
  }

  return results;
}

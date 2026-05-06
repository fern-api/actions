import * as exec from "@actions/exec";
import type { ResolvedFernCli } from "@fern-github-actions/shared";

export interface GeneratorUpgradeEntry {
  name: string;
  group: string;
  api: string | null;
  from: string;
  to: string;
  changelog: string | undefined;
  migrationsApplied: number;
}

export interface SkippedMajorEntry {
  name: string;
  current: string;
  latest: string;
}

export interface AlreadyUpToDateEntry {
  name: string;
  version: string;
}

export interface AutomationsUpgradeJson {
  cli: {
    from: string;
    to: string;
    upgraded: boolean;
  };
  generators: GeneratorUpgradeEntry[];
  skippedMajor: SkippedMajorEntry[];
  alreadyUpToDate: AlreadyUpToDateEntry[];
}

const UPGRADE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Runs `fern automations upgrade --json` and returns the parsed JSON output.
 * JSON is emitted to stdout by the CLI; logs go to stderr.
 */
export async function runAutomationsUpgrade({
  cli,
  fernToken,
  includeMajor,
}: {
  cli: ResolvedFernCli;
  fernToken: string;
  includeMajor: boolean;
}): Promise<AutomationsUpgradeJson> {
  const args = [...cli.leadingArgs, "automations", "upgrade", "--json"];
  if (!includeMajor) {
    args.push("--no-include-major");
  }

  let stdout = "";
  let stderr = "";
  const exitCode = await withTimeout(
    exec.exec(cli.command, args, {
      env: { ...process.env, FERN_TOKEN: fernToken },
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
        stderr: (data: Buffer) => {
          stderr += data.toString();
        },
      },
      ignoreReturnCode: true,
    }),
    UPGRADE_TIMEOUT_MS,
    `fern automations upgrade timed out after ${UPGRADE_TIMEOUT_MS / 60000} minutes`
  );

  if (exitCode !== 0) {
    throw new Error(
      `fern automations upgrade failed with exit code ${exitCode}. Check the Actions run log for details.`
    );
  }

  // Parse JSON from CLI output. Try stdout first, then fall back to stderr
  // (version redirection may route output to stderr).
  const parsed = extractUpgradeJson(stdout) ?? extractUpgradeJson(stderr);
  if (!parsed) {
    throw new Error(
      "fern automations upgrade produced no parseable JSON output. " +
        "Ensure the CLI version supports 'fern automations upgrade --json'."
    );
  }

  return parsed;
}

/**
 * Extracts the upgrade JSON from CLI output that may contain non-JSON log lines.
 */
export function extractUpgradeJson(output: string): AutomationsUpgradeJson | undefined {
  if (!output.trim()) {
    return undefined;
  }

  // Happy path: output is clean JSON
  try {
    const obj = JSON.parse(output.trim()) as AutomationsUpgradeJson;
    if (obj.cli && Array.isArray(obj.generators)) {
      return obj;
    }
  } catch {
    // Expected when log lines are mixed in
  }

  // Fallback: find lines that look like the start of a JSON object and try
  // to parse from there to the end.
  const lines = output.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith("{")) {
      for (let j = lines.length - 1; j >= i; j--) {
        if (lines[j].trimEnd().endsWith("}")) {
          try {
            const candidate = lines.slice(i, j + 1).join("\n");
            const obj = JSON.parse(candidate) as AutomationsUpgradeJson;
            if (obj.cli && Array.isArray(obj.generators)) {
              return obj;
            }
          } catch {
            // Not valid JSON for this range — keep scanning
          }
        }
      }
    }
  }

  return undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

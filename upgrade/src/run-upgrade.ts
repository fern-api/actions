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

export interface PrSuggestion {
  title: string;
  body: string;
  commitMessage: string;
}

export interface AutomationsUpgradeJson {
  cli: {
    from: string;
    to: string;
    upgraded: boolean;
  };
  generators: GeneratorUpgradeEntry[];
  skippedMajor: { name: string; current: string; latest: string }[];
  alreadyUpToDate: { name: string; version: string }[];
  pr: PrSuggestion | null;
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
      `fern automations upgrade failed with exit code ${exitCode}.\nstderr: ${stderr.slice(0, 2000)}`
    );
  }

  if (!stdout.trim()) {
    throw new Error(
      "fern automations upgrade produced no JSON output on stdout. " +
        "Ensure the CLI version supports 'fern automations upgrade --json'."
    );
  }

  const parsed = JSON.parse(stdout.trim()) as AutomationsUpgradeJson;
  if (!parsed.cli || !Array.isArray(parsed.generators)) {
    throw new Error(
      `fern automations upgrade returned unexpected JSON schema. Expected { cli, generators, ... } — got: ${stdout.trim().slice(0, 200)}`
    );
  }

  return parsed;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

import * as core from "@actions/core";
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

  const cliExec = exec.getExecOutput(cli.command, args, {
    env: { ...process.env, FERN_TOKEN: fernToken },
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stderr: (data: Buffer) => {
        core.info(data.toString().trimEnd());
      },
    },
  });

  const timeout = new Promise<never>((_resolve, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `fern automations upgrade timed out after ${UPGRADE_TIMEOUT_MS / 60000} minutes`
          )
        ),
      UPGRADE_TIMEOUT_MS
    );
  });

  const result = await Promise.race([cliExec, timeout]);

  if (result.exitCode !== 0) {
    throw new Error(
      `fern automations upgrade failed with exit code ${result.exitCode}.\nstderr: ${result.stderr.slice(0, 2000)}`
    );
  }

  return parseUpgradeOutput(result.stdout);
}

/**
 * Parses and validates the raw stdout from `fern automations upgrade --json`.
 * Exported separately so it can be unit-tested without spawning a child process.
 */
export function parseUpgradeOutput(stdout: string): AutomationsUpgradeJson {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error(
      "fern automations upgrade produced no JSON output on stdout. " +
        "Ensure the CLI version supports 'fern automations upgrade --json'."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`fern automations upgrade returned invalid JSON: ${trimmed.slice(0, 200)}`);
  }

  const result = parsed as AutomationsUpgradeJson;
  if (!result.cli || !Array.isArray(result.generators)) {
    throw new Error(
      `fern automations upgrade returned unexpected JSON schema. Expected { cli, generators, ... } — got: ${trimmed.slice(0, 200)}`
    );
  }

  // Validate pr sub-fields when pr is present
  if (result.pr != null) {
    if (!result.pr.title || !result.pr.body || !result.pr.commitMessage) {
      throw new Error(
        "fern automations upgrade returned pr object with missing fields. " +
          "Expected { title, body, commitMessage }."
      );
    }
  }

  return result;
}

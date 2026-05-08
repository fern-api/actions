import { spawn } from "node:child_process";
import * as core from "@actions/core";
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

  const exitCode = await new Promise<number>((resolve, reject) => {
    let settled = false;
    let exited = false;

    const child = spawn(cli.command, args, {
      env: { ...process.env, FERN_TOKEN: fernToken },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      core.info(chunk.trimEnd());
    });

    child.on("close", (code) => {
      exited = true;
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve(code ?? 1);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      // Give the process 5 seconds to exit gracefully, then force-kill
      setTimeout(() => {
        if (!exited) {
          child.kill("SIGKILL");
        }
      }, 5000);
      // Wait for the process to actually die before rejecting, so the caller
      // doesn't race with a still-alive child writing to the working directory.
      const waitForExit = setInterval(() => {
        if (exited && !settled) {
          clearInterval(waitForExit);
          settled = true;
          reject(
            new Error(
              `fern automations upgrade timed out after ${UPGRADE_TIMEOUT_MS / 60000} minutes`
            )
          );
        }
      }, 100);
    }, UPGRADE_TIMEOUT_MS);
  });

  if (exitCode !== 0) {
    throw new Error(
      `fern automations upgrade failed with exit code ${exitCode}.\nstderr: ${stderr.slice(0, 2000)}`
    );
  }

  return parseUpgradeOutput(stdout);
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
  return result;
}

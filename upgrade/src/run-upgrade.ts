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

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      // Give the process a few seconds to clean up, then force-kill
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 5000);
      reject(
        new Error(`fern automations upgrade timed out after ${UPGRADE_TIMEOUT_MS / 60000} minutes`)
      );
    }, UPGRADE_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

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

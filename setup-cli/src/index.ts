import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  getOrCreateRunId,
  installFernCli,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";

async function buildCliFromSource(repoRef: string): Promise<void> {
  core.info(`Building Fern CLI from source (ref: ${repoRef})`);
  const buildDir = mkdtempSync(join(tmpdir(), "fern-cli-build-"));

  await exec.exec("git", [
    "clone",
    "--branch",
    repoRef,
    "--depth",
    "1",
    "https://github.com/fern-api/fern.git",
    buildDir,
  ]);
  await exec.exec("corepack", ["enable"]);
  await exec.exec("corepack", ["prepare", "--activate"], { cwd: buildDir });
  await exec.exec("pnpm", ["install", "--frozen-lockfile"], { cwd: buildDir });
  await exec.exec("pnpm", ["turbo", "run", "dist:cli:prod", "--filter", "@fern-api/cli"], {
    cwd: buildDir,
  });

  const cliPath = join(buildDir, "packages/cli/cli/dist/prod/cli.cjs");
  const shimPath = "/usr/local/bin/fern";
  writeFileSync(shimPath, `#!/usr/bin/env node\nrequire("${cliPath}");\n`);
  chmodSync(shimPath, 0o755);

  let stdout = "";
  await exec.exec("fern", ["--version"], {
    env: { ...process.env, FERN_NO_VERSION_REDIRECTION: "true" },
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
    },
  });
  core.info(`Installed Fern CLI version ${stdout.trim()}`);
}

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("setup-cli", async () => {
    const version = core.getInput("version") || "latest";
    const repoRef = core.getInput("repo-ref");

    const runId = getOrCreateRunId();
    core.setOutput("run-id", runId);

    if (repoRef) {
      await buildCliFromSource(repoRef);
    } else {
      await installFernCli(version);
    }
  });
});

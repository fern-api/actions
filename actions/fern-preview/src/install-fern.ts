import { writeFileSync } from "node:fs";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function installFernCli(version: string, repoRef?: string): Promise<void> {
  if (repoRef) {
    await installFromSource(repoRef);
    return;
  }

  const pkg = version === "latest" || version === "auto" ? "fern-api" : `fern-api@${version}`;
  core.info(`Installing Fern CLI: ${pkg}`);
  await exec.exec("npm", ["install", "-g", pkg]);

  await verifyInstallation();
}

async function installFromSource(ref: string): Promise<void> {
  core.info(`Building Fern CLI from source (ref: ${ref})`);

  const buildDir = "/tmp/fern-cli-build";

  // Clone the repo at the specified ref (shallow clone for speed)
  await exec.exec("git", [
    "clone",
    "--branch",
    ref,
    "--depth",
    "1",
    "https://github.com/fern-api/fern.git",
    buildDir,
  ]);

  // Install pnpm globally (corepack enable can be unreliable on some runners)
  await exec.exec("npm", ["install", "-g", "pnpm"]);

  // Install dependencies
  await exec.exec("pnpm", ["install", "--frozen-lockfile"], { cwd: buildDir });

  // Build the production CLI bundle
  await exec.exec("pnpm", ["turbo", "run", "dist:cli:prod", "--filter", "@fern-api/cli"], {
    cwd: buildDir,
  });

  // Create a global wrapper script that invokes the built CLI
  const cliPath = `${buildDir}/packages/cli/cli/dist/prod/cli.cjs`;
  const wrapperPath = "/usr/local/bin/fern";
  writeFileSync(wrapperPath, `#!/usr/bin/env node\nrequire("${cliPath}");\n`, { mode: 0o755 });

  await verifyInstallation();
}

async function verifyInstallation(): Promise<void> {
  let installedVersion = "";
  await exec.exec("fern", ["--version"], {
    env: { ...process.env, FERN_NO_VERSION_REDIRECTION: "true" },
    listeners: {
      stdout: (data: Buffer) => {
        installedVersion += data.toString();
      },
    },
    silent: true,
  });
  core.info(`Installed Fern CLI version: ${installedVersion.trim()}`);
}

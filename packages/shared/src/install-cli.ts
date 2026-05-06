import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";

/**
 * Installs the Fern CLI globally via npm. Mirrors the npm-install branch of
 * the setup-cli action. Throws if npm/node are missing.
 *
 * For 'auto' or 'latest', installs `fern-api` (the CLI then handles version
 * redirection at runtime via fern.config.json). For any other value, pins to
 * `fern-api@<version>`.
 *
 * Does NOT support repo-ref / source builds — that is intentionally left to
 * setup-cli, which is the action users reach for when they need that mode.
 */
export async function installFernCli(version: string): Promise<void> {
  const npm = await io.which("npm", false);
  if (!npm) {
    throw new Error("npm is not available. Please add a Node.js setup step before this action.");
  }
  const node = await io.which("node", false);
  if (!node) {
    throw new Error("node is not available. Please add a Node.js setup step before this action.");
  }

  const pkg = version === "latest" || version === "auto" ? "fern-api" : `fern-api@${version}`;
  await exec.exec("npm", ["install", "-g", pkg]);

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

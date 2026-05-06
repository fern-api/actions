import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import { WrapperError } from "./telemetry/errors.js";

/**
 * Installs the Fern CLI globally via npm. Mirrors the npm-install branch of
 * the setup-cli action. Throws `WrapperError("cli_install_failure", ...)`
 * if npm/node are missing or the install fails — the wrapper's top-level
 * catch translates that into a `wrapper_failed` event with cause
 * `cli_install_failure`.
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
    throw new WrapperError({
      errorCode: "CLI_INSTALL_NPM_MISSING",
      message: "npm is not available. Please add a Node.js setup step before this action.",
    });
  }
  const node = await io.which("node", false);
  if (!node) {
    throw new WrapperError({
      errorCode: "CLI_INSTALL_NODE_MISSING",
      message: "node is not available. Please add a Node.js setup step before this action.",
    });
  }

  const pkg = version === "latest" || version === "auto" ? "fern-api" : `fern-api@${version}`;
  try {
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
  } catch (err) {
    if (err instanceof WrapperError) {
      throw err;
    }
    throw new WrapperError({
      errorCode: "CLI_INSTALL_NPM_FAILED",
      message: err instanceof Error ? err.message : String(err),
      originalError: err,
    });
  }
}

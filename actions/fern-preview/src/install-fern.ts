import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function installFernCli(version: string): Promise<void> {
  const pkg = version === "latest" ? "fern-api" : `fern-api@${version}`;
  core.info(`Installing Fern CLI: ${pkg}`);
  await exec.exec("npm", ["install", "-g", pkg]);

  // Verify installation
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

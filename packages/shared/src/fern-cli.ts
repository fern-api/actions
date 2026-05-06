import * as core from "@actions/core";
import * as io from "@actions/io";

/**
 * Resolves how to invoke the Fern CLI based on a version string. Returns the
 * command name and any leading args (e.g. `npx --yes fern-api@latest`) so
 * callers can spawn it via `exec.exec(cmd, [...leadingArgs, ...userArgs])`
 * without going through a shell.
 *
 * Mirrors the behavior of the resolve-cli action: 'auto' uses
 * fern-api@latest with version-redirection enabled (so the CLI honors
 * fern.config.json), 'inherit' requires `fern` on PATH, and any other value
 * pins to that npm version with redirection disabled.
 *
 * Side effect: when the version is not 'auto', sets
 * FERN_NO_VERSION_REDIRECTION=true via core.exportVariable so child Fern
 * processes inherit it (matches the composite action's behavior).
 */
export interface ResolvedFernCli {
  command: string;
  leadingArgs: string[];
}

export async function resolveFernCli(version: string): Promise<ResolvedFernCli> {
  let resolved: ResolvedFernCli;
  if (version === "auto") {
    resolved = { command: "npx", leadingArgs: ["--yes", "fern-api@latest"] };
  } else if (version === "inherit") {
    const fernPath = await io.which("fern", false);
    if (!fernPath) {
      throw new Error("version is 'inherit' but fern is not on PATH.");
    }
    core.exportVariable("FERN_NO_VERSION_REDIRECTION", "true");
    resolved = { command: "fern", leadingArgs: [] };
  } else {
    core.exportVariable("FERN_NO_VERSION_REDIRECTION", "true");
    resolved = { command: "npx", leadingArgs: ["--yes", `fern-api@${version}`] };
  }

  core.info(`Using Fern CLI: ${[resolved.command, ...resolved.leadingArgs].join(" ")}`);
  return resolved;
}

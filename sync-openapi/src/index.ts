import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  WrapperError,
  getOptionalInput,
  getRequiredInput,
  injectFernToken,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  resolveFernCli,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";
import { buildPullSpecArgs, buildSyncSpecsArgs } from "./build-args.js";

interface ActionInputs {
  version: string;
  token: string;
  updateFromSource: boolean;
  repository?: string;
  sources?: string;
  branch?: string;
  autoMerge: boolean;
}

function parseInputs(): ActionInputs {
  return {
    version: core.getInput("version") || "latest",
    token: getRequiredInput("token"),
    updateFromSource: core.getBooleanInput("update_from_source"),
    repository: getOptionalInput("repository"),
    sources: getOptionalInput("sources"),
    branch: getOptionalInput("branch"),
    autoMerge: core.getBooleanInput("auto_merge"),
  };
}

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("sync-openapi", async () => {
    const inputs = parseInputs();
    core.setSecret(inputs.token);
    injectFernToken(inputs.token);

    const cli = await resolveFernCli(inputs.version);
    const env = { ...process.env, FERN_TOKEN: inputs.token };

    const subcommand = inputs.updateFromSource ? "pull-spec" : "sync-specs";
    const args = inputs.updateFromSource ? buildPullSpecArgs(inputs) : buildSyncSpecsArgs(inputs);
    const errorCode =
      subcommand === "pull-spec" ? "CLI_GHA_PULL_SPEC_FAILED" : "CLI_GHA_SYNC_SPECS_FAILED";

    try {
      await exec.exec(cli.command, [...cli.leadingArgs, "gha", subcommand, ...args], { env });
    } catch (err) {
      throw new WrapperError({
        errorCode,
        message: err instanceof Error ? err.message : String(err),
        originalError: err,
      });
    }
  });
});

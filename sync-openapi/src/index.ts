import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  getOptionalInput,
  getRequiredInput,
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

    const cli = await resolveFernCli(inputs.version);
    const env = { ...process.env, FERN_TOKEN: inputs.token };

    if (inputs.updateFromSource) {
      const args = buildPullSpecArgs(inputs);
      await exec.exec(cli.command, [...cli.leadingArgs, "gha", "pull-spec", ...args], { env });
    } else {
      const args = buildSyncSpecsArgs(inputs);
      await exec.exec(cli.command, [...cli.leadingArgs, "gha", "sync-specs", ...args], { env });
    }
  });
});

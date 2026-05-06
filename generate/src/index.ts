import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  getOptionalInput,
  getOrCreateRunId,
  getRequiredFernToken,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  resolveFernCli,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";
import { buildGenerateArgs } from "./build-args.js";

interface ActionInputs {
  fernToken: string;
  autoMerge: boolean;
  group?: string;
  api?: string;
  generator?: string;
  version?: string;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredFernToken(),
    autoMerge: core.getBooleanInput("auto-merge"),
    group: getOptionalInput("group"),
    api: getOptionalInput("api"),
    generator: getOptionalInput("generator"),
    version: getOptionalInput("version"),
  };
}

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("generate", async () => {
    const inputs = parseInputs();
    getOrCreateRunId();

    const cli = await resolveFernCli("auto");
    const userArgs = buildGenerateArgs(inputs);

    await exec.exec(cli.command, [...cli.leadingArgs, "automations", "generate", ...userArgs], {
      env: { ...process.env, FERN_TOKEN: inputs.fernToken },
    });
  });
});

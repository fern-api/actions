import * as core from "@actions/core";
import * as exec from "@actions/exec";
import {
  WrapperError,
  getOptionalInput,
  getOrCreateRunId,
  getRequiredFernToken,
  injectFernToken,
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
    injectFernToken(inputs.fernToken);
    getOrCreateRunId();

    const cli = await resolveFernCli("auto");
    const userArgs = buildGenerateArgs(inputs);

    try {
      await exec.exec(cli.command, [...cli.leadingArgs, "automations", "generate", ...userArgs], {
        env: { ...process.env, FERN_TOKEN: inputs.fernToken },
      });
    } catch (err) {
      throw new WrapperError({
        errorCode: "CLI_AUTOMATIONS_GENERATE_FAILED",
        message: err instanceof Error ? err.message : String(err),
        originalError: err,
      });
    }
  });
});

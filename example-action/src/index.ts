import * as core from "@actions/core";
import {
  getRequiredInput,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";

interface ActionInputs {
  githubToken: string;
  message: string;
  dryRun: boolean;
}

function parseInputs(): ActionInputs {
  return {
    githubToken: getRequiredInput("github-token"),
    message: getRequiredInput("message"),
    dryRun: core.getBooleanInput("dry-run"),
  };
}

async function run(inputs: ActionInputs): Promise<void> {
  core.info(`Processing message: ${inputs.message}`);

  if (inputs.dryRun) {
    core.info("[dry-run] Skipping side effects.");
  } else {
    core.info(`Executing with message: ${inputs.message}`);
  }

  const result = `Processed: ${inputs.message}`;
  core.setOutput("result", result);
  core.info(`Done. Output: ${result}`);
}

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("example-action", async () => {
    const inputs = parseInputs();
    await run(inputs);
  });
});

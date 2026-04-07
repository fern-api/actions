import * as core from "@actions/core";
import { getOptionalInput, getRequiredInput, runAction } from "@fern-github-actions/shared";

interface ActionInputs {
  fernToken: string;
  autoMerge: boolean;
  reviewers: string | undefined;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredInput("fern-token"),
    autoMerge: core.getBooleanInput("auto-merge"),
    reviewers: getOptionalInput("reviewers"),
  };
}

async function run(_inputs: ActionInputs): Promise<void> {
  const runId = crypto.randomUUID();
  core.setOutput("run-id", runId);
  core.exportVariable("FERN_RUN_ID", runId);
  core.info(`Starting fern-generate run ${runId}`);

  // TODO: T011 — emit generation_started telemetry
  // TODO: T011 — call fern generate
  // TODO: T014 — breaking change detection
  // TODO: T015 — SDK PR creation
  // TODO: T016 — no-diff detection
  // TODO: T017 — failure issue creation
  // TODO: T019 — emit sdk_pr_created / verification_failed telemetry

  core.setOutput("prs-created", JSON.stringify([]));
  core.setOutput("generators-failed", JSON.stringify([]));
}

runAction(async () => {
  const inputs = parseInputs();
  await run(inputs);
});

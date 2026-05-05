import * as core from "@actions/core";
import {
  getOptionalInput,
  getOrCreateRunId,
  getRequiredInput,
  runAction,
} from "@fern-github-actions/shared";

interface ActionInputs {
  fernToken: string;
  reviewers: string | undefined;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredInput("fern-token"),
    reviewers: getOptionalInput("reviewers"),
  };
}

async function run(_inputs: ActionInputs): Promise<void> {
  const runId = getOrCreateRunId();
  core.setOutput("run-id", runId);
  core.info(`Starting fern-verify run ${runId}`);

  // TODO: T027 — run fern generate --preview
  // TODO: T027 — run self-verification per generator
  // TODO: T027 — run fern diff for breaking change detection
  // TODO: T028 — automerge decision logic
  // TODO: T029 — fern-bot PR comment management
  // TODO: T030 — reviewer request with CODEOWNERS fallback
  // TODO: T031 — emit preview_completed telemetry

  core.setOutput("verification-passed", "false");
  core.setOutput("breaking-changes", "false");
  core.setOutput("automerge-enabled", "false");
}

runAction(async () => {
  const inputs = parseInputs();
  await run(inputs);
});

import * as core from "@actions/core";
import { getRequiredInput, runAction } from "@fern-github-actions/shared";

interface ActionInputs {
  fernToken: string;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredInput("fern-token"),
  };
}

async function run(_inputs: ActionInputs): Promise<void> {
  const runId = crypto.randomUUID();
  core.setOutput("run-id", runId);
  core.exportVariable("FERN_RUN_ID", runId);
  core.info(`Starting fern-upgrade run ${runId}`);

  // TODO: T021 — run fern upgrade (CLI bump)
  // TODO: T021 — run fern generator upgrade (generator bumps)
  // TODO: T022 — find/create/update upgrade PR on fern/upgrade branch
  // TODO: T023 — generate PR title/body with changelog
  // TODO: T024 — emit upgrade_applied / upgrade_available telemetry

  core.setOutput("pr-url", "");
  core.setOutput("cli-upgraded", "false");
  core.setOutput("generators-upgraded", JSON.stringify([]));
}

runAction(async () => {
  const inputs = parseInputs();
  await run(inputs);
});

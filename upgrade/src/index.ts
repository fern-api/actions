import * as core from "@actions/core";
import {
  getOrCreateRunId,
  getRequiredFernToken,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  resolveFernCli,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";
import { pushAndManagePr } from "./manage-pr.js";
import { runAutomationsUpgrade } from "./run-upgrade.js";

interface ActionInputs {
  fernToken: string;
  version: string;
  includeMajor: boolean;
  githubToken: string;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredFernToken(),
    version: core.getInput("version") || "latest",
    includeMajor: core.getBooleanInput("include-major"),
    githubToken: core.getInput("github-token") || process.env.GITHUB_TOKEN || "",
  };
}

async function run(inputs: ActionInputs): Promise<void> {
  const runId = getOrCreateRunId();
  core.setOutput("run-id", runId);

  if (inputs.githubToken) {
    core.setSecret(inputs.githubToken);
  }

  const cli = await resolveFernCli(inputs.version);
  const json = await runAutomationsUpgrade({
    cli,
    fernToken: inputs.fernToken,
    includeMajor: inputs.includeMajor,
  });

  if (json.pr == null) {
    core.info("No upgrades available. Everything is up to date.");
    core.setOutput("pr-url", "");
    core.setOutput("cli-upgraded", "false");
    core.setOutput("generators-upgraded", JSON.stringify([]));
    return;
  }

  core.setOutput("cli-upgraded", String(json.cli.upgraded));
  core.setOutput(
    "generators-upgraded",
    JSON.stringify(json.generators.map((g) => ({ generator: g.name, from: g.from, to: g.to })))
  );

  const prUrl = await pushAndManagePr({
    commitMsg: json.pr.commitMessage,
    prTitle: json.pr.title,
    prBody: json.pr.body,
    githubToken: inputs.githubToken,
  });

  core.setOutput("pr-url", prUrl);
}

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("upgrade", async () => {
    const inputs = parseInputs();
    await run(inputs);
  });
});

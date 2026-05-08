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
  const githubToken = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  if (!githubToken) {
    throw new Error(
      "github-token is required. Provide it as an input or ensure GITHUB_TOKEN is available."
    );
  }

  return {
    fernToken: getRequiredFernToken(),
    // "latest" is intentional: the upgrade action should always use the newest CLI
    // release to perform upgrades, regardless of fern.config.json. This differs from
    // the generate action which uses "auto" (respects version pinning).
    version: core.getInput("version") || "latest",
    includeMajor: core.getBooleanInput("include-major"),
    githubToken,
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

  core.info(`PR title: ${json.pr.title}`);

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

  if (!prUrl) {
    core.warning(
      "CLI reported upgrades available (pr is non-null) but no file changes were detected. " +
        "This may indicate a bug in the file copy/staging logic."
    );
  }

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

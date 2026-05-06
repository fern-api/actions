import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  getOptionalInput,
  getRequiredFernToken,
  installFernCli,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";
import { normalizeFernVersion } from "./parse-inputs.js";
import { postOrUpdateComment } from "./post-comment.js";
import { runAutomationsPreview } from "./run-preview.js";

interface ActionInputs {
  fernToken: string;
  fernVersion: string;
  githubToken: string | undefined;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredFernToken(),
    fernVersion: normalizeFernVersion(getOptionalInput("fern-version")),
    githubToken: getOptionalInput("github-token"),
  };
}

async function run(inputs: ActionInputs): Promise<void> {
  await installFernCli(inputs.fernVersion);

  const results = await runAutomationsPreview({ fernToken: inputs.fernToken });

  if (results.length === 0) {
    core.info("No eligible generator groups found. Skipping preview.");
    core.setOutput("results", "[]");
    return;
  }

  const prNumber = github.context.payload.pull_request?.number;

  if (prNumber != null) {
    if (!inputs.githubToken) {
      core.warning("Skipping PR comment: github-token input is empty.");
    } else {
      try {
        await postOrUpdateComment({ results, prNumber, token: inputs.githubToken });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to post PR comment: ${message}`);
      }
    }
  } else {
    core.info("Not a pull request event — skipping PR comment.");
    for (const result of results) {
      if (result.status === "success" && result.installCommand) {
        core.info(`${result.groupName}: ${result.installCommand}`);
      }
    }
  }

  core.setOutput("results", JSON.stringify(results));
}

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("preview", async () => {
    const inputs = parseInputs();
    if (inputs.githubToken) {
      core.setSecret(inputs.githubToken);
    }
    await run(inputs);
  });
});

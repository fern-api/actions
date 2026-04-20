import * as core from "@actions/core";
import * as github from "@actions/github";
import { getRequiredInput, runAction } from "@fern-github-actions/shared";
import { postOrUpdateComment } from "./post-comment.js";
import { runAutomationsPreview } from "./run-preview.js";

interface ActionInputs {
  fernToken: string;
  githubToken: string;
  pushDiff: boolean;
}

function parseInputs(): ActionInputs {
  return {
    fernToken: getRequiredInput("fern-token"),
    githubToken: getRequiredInput("github-token"),
    pushDiff: core.getBooleanInput("push-diff"),
  };
}

async function run(inputs: ActionInputs): Promise<void> {
  // CLI installation is handled by setup-cli (composite action step).
  // Detection and execution are now handled by `fern automations preview`.

  const results = await runAutomationsPreview({
    fernToken: inputs.fernToken,
    pushDiff: inputs.pushDiff,
  });

  if (results.length === 0) {
    core.info("No eligible generator groups found. Skipping preview.");
    core.setOutput("results", "[]");
    return;
  }

  const prNumber = github.context.payload.pull_request?.number;

  if (prNumber != null) {
    try {
      await postOrUpdateComment({ results, prNumber, token: inputs.githubToken });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Failed to post PR comment: ${message}`);
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
  const inputs = parseInputs();
  await run(inputs);
});

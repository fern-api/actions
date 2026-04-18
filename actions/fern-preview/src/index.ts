import * as core from "@actions/core";
import * as github from "@actions/github";
import { getRequiredInput, runAction } from "@fern-github-actions/shared";
import { detectPreviewGroups } from "./detect-groups.js";
import { postOrUpdateComment } from "./post-comment.js";
import { type PreviewResult, runPreview } from "./run-preview.js";

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

  // 1. Detect generator groups eligible for preview
  const groups = detectPreviewGroups({ generators: "typescript" });
  if (groups.length === 0) {
    core.info("No eligible generator groups found. Skipping preview.");
    return;
  }
  core.info(`Found ${groups.length} group(s): ${groups.map((g) => g.groupName).join(", ")}`);

  const prNumber = github.context.payload.pull_request?.number;

  // 2. Run preview for each group.
  //    `fern sdk preview` (no --output) routes through Fiddle by default.
  //    Fiddle handles: npm publish to preview registry + diff branch push to SDK repo.
  const results: PreviewResult[] = [];
  for (const group of groups) {
    core.startGroup(
      `Preview: ${group.groupName}${group.apiName ? ` (api: ${group.apiName})` : ""}`
    );
    try {
      const result = await runPreview({
        groupName: group.groupName,
        apiName: group.apiName,
        fernToken: inputs.fernToken,
        pushDiff: inputs.pushDiff,
      });
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Preview failed for group '${group.groupName}': ${message}`);
      results.push({
        status: "error",
        groupName: group.groupName,
        error: message,
      });
    }
    core.endGroup();
  }

  // 3. Post or update PR comment
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

  // 4. Set action outputs
  core.setOutput("results", JSON.stringify(results));
}

runAction(async () => {
  const inputs = parseInputs();
  await run(inputs);
});

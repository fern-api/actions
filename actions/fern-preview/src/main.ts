import * as core from "@actions/core";
import * as github from "@actions/github";
import { detectPreviewGroups } from "./detect-groups.js";
import { installFernCli } from "./install-fern.js";
import { postOrUpdateComment } from "./post-comment.js";
import { type PreviewResult, runPreview } from "./run-preview.js";

async function run(): Promise<void> {
  try {
    const fernToken = core.getInput("fern-token", { required: true });
    const fernVersion = core.getInput("fern-version") || "latest";
    const githubToken = core.getInput("github-token", { required: true });
    const pushDiff = core.getInput("push-diff") !== "false";
    const fernRepoRef = core.getInput("fern-repo-ref") || undefined;

    // 1. Install Fern CLI
    await installFernCli(fernVersion, fernRepoRef);

    // 2. Detect generator groups eligible for preview
    const groups = detectPreviewGroups({ generators: "typescript" });
    if (groups.length === 0) {
      core.info("No eligible generator groups found. Skipping preview.");
      return;
    }
    core.info(`Found ${groups.length} group(s): ${groups.map((g) => g.groupName).join(", ")}`);

    const prNumber = github.context.payload.pull_request?.number;

    // 3. Run preview for each group.
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
          fernToken,
          pushDiff,
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

    // 4. Post or update PR comment
    if (prNumber != null) {
      try {
        await postOrUpdateComment({ results, prNumber, token: githubToken });
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

    // 5. Set action outputs
    core.setOutput("results", JSON.stringify(results));
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}

run();

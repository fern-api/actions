import * as core from "@actions/core";
import * as github from "@actions/github";
import { detectTypeScriptGroups } from "./detect-groups.js";
import { installFernCli } from "./install-fern.js";
import { postOrUpdateComment } from "./post-comment.js";
import { pushDiffBranch } from "./push-diff.js";
import { type PreviewResult, runPreview } from "./run-preview.js";

async function run(): Promise<void> {
  try {
    const fernToken = core.getInput("fern-token", { required: true });
    const githubToken = core.getInput("github-token");
    const fernVersion = core.getInput("fern-version") || "latest";

    // 1. Install Fern CLI
    await installFernCli(fernVersion);

    // 2. Detect all TypeScript generator groups
    const groups = await detectTypeScriptGroups();
    if (groups.length === 0) {
      core.info("No TypeScript generator groups found. Skipping preview.");
      return;
    }
    core.info(
      `Found ${groups.length} TypeScript group(s): ${groups.map((g) => g.groupName).join(", ")}`
    );

    // Resolve PR number early — used for branch naming and comment posting
    const prNumber = github.context.payload.pull_request?.number;

    // 3. Run preview for each group (publish to registry + write to disk)
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
        });
        // Overlay sdkRepo from detect-groups (generator config may not include it in JSON output)
        results.push({ ...result, sdkRepo: result.sdkRepo ?? group.sdkRepo });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Preview failed for group '${group.groupName}': ${message}`);
        results.push({
          status: "error",
          groupName: group.groupName,
          sdkRepo: group.sdkRepo,
          error: message,
        });
      }
      core.endGroup();
    }

    // 4. Push diff branches for successful previews that have SDK repos
    for (const result of results) {
      if (result.status === "success" && result.sdkRepo && result.outputPath) {
        core.startGroup(`SDK diff: ${result.groupName} → ${result.sdkRepo}`);
        try {
          const diffUrl = await pushDiffBranch({
            sdkRepo: result.sdkRepo,
            outputPath: result.outputPath,
            previewId: result.previewId ?? "unknown",
            prNumber,
            githubToken,
          });
          result.diffUrl = diffUrl;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          core.warning(`Failed to push diff for '${result.groupName}': ${message}`);
        }
        core.endGroup();
      }
    }

    // 5. Post or update PR comment
    if (prNumber) {
      await postOrUpdateComment({ results, githubToken, prNumber });
    } else {
      core.info("Not a pull request event — skipping PR comment.");
      for (const result of results) {
        if (result.status === "success" && result.installCommand) {
          core.info(`${result.groupName}: ${result.installCommand}`);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}

run();

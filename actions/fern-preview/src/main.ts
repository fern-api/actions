import * as core from "@actions/core";
import * as github from "@actions/github";
import { detectPreviewGroups } from "./detect-groups.js";
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

    // 2. Detect generator groups eligible for preview
    const groups = detectPreviewGroups({ generators: "typescript" });
    if (groups.length === 0) {
      core.info("No eligible generator groups found. Skipping preview.");
      return;
    }
    core.info(`Found ${groups.length} group(s): ${groups.map((g) => g.groupName).join(", ")}`);

    // Resolve PR number early — used for branch naming and comment posting
    const prNumber = github.context.payload.pull_request?.number;
    const sourceOwner = github.context.repo.owner;

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

    // 4. Push diff branches for successful previews that have SDK repos.
    //    Only when running in a PR context — outside PRs there's no comment
    //    to attach the diff link to and no PR number for a unique branch name.
    const diffUrls = new Map<string, string>();
    if (prNumber != null) {
      for (const result of results) {
        if (result.status === "success" && result.sdkRepo && result.outputPath) {
          // Guard against pushing to repos outside the source owner.
          // generators.yml is PR-author controlled, so sdkRepo could point
          // anywhere. Restrict to same-owner repos by default.
          const repoOwner = result.sdkRepo.split("/")[0];
          if (repoOwner !== sourceOwner) {
            core.warning(
              `Skipping diff push for '${result.groupName}': ` +
                `SDK repo '${result.sdkRepo}' is not owned by '${sourceOwner}'`
            );
            continue;
          }

          core.startGroup(`SDK diff: ${result.groupName} → ${result.sdkRepo}`);
          try {
            const diffUrl = await pushDiffBranch({
              sdkRepo: result.sdkRepo,
              outputPath: result.outputPath,
              prNumber,
              githubToken,
            });
            if (diffUrl) {
              diffUrls.set(result.groupName, diffUrl);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            core.warning(`Failed to push diff for '${result.groupName}': ${message}`);
          }
          core.endGroup();
        }
      }
    }

    // 5. Post or update PR comment
    if (prNumber != null) {
      try {
        await postOrUpdateComment({ results, diffUrls, githubToken, prNumber });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Failed to post PR comment: ${message}`);
      }
    } else {
      core.info("Not a pull request event — skipping PR comment and SDK diff.");
      for (const result of results) {
        if (result.status === "success" && result.installCommand) {
          core.info(`${result.groupName}: ${result.installCommand}`);
        }
      }
    }

    // 6. Set action outputs
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

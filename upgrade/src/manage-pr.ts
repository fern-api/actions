import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";

const UPGRADE_BRANCH = "fern/upgrade";

/**
 * Pushes changes to the fern/upgrade branch and creates or updates a PR.
 * Uses a clean-slate model: each run resets the branch to the latest default
 * branch HEAD, applies the upgrade, and force-pushes.
 *
 * Returns the PR URL, or empty string if no PR was created.
 */
export async function pushAndManagePr({
  commitMsg,
  prTitle,
  prBody,
  githubToken,
}: {
  commitMsg: string;
  prTitle: string;
  prBody: string;
  githubToken: string;
}): Promise<string> {
  const octokit = github.getOctokit(githubToken);
  const { owner, repo } = github.context.repo;

  // Get default branch
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;
  core.info(`Default branch: ${defaultBranch}`);

  // Configure git
  await exec.exec("git", ["config", "user.name", "github-actions[bot]"]);
  await exec.exec("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);

  // Fetch the default branch ref (shallow checkouts from pull_request events don't include it)
  await exec.exec("git", ["fetch", "origin", defaultBranch]);

  // Save the CLI-modified fern/ directory to a temp location before switching branches.
  // We can't use git stash because files may exist on the checked-out branch but not on
  // origin/main, causing merge conflicts on stash pop.
  const tmpDir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || "/tmp", "fern-upgrade-"));
  await exec.exec("cp", ["-a", "fern", tmpDir]);

  // Reset to clean slate from default branch (creates or overwrites fern/upgrade)
  await exec.exec("git", ["checkout", "-B", UPGRADE_BRANCH, `origin/${defaultBranch}`, "--force"]);

  // Restore the CLI-modified fern/ directory
  await exec.exec("rm", ["-rf", "fern"]);
  await exec.exec("cp", ["-a", path.join(tmpDir, "fern"), "."]);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Stage only fern/ directory changes.
  // The CLI modifies files under fern/ (fern.config.json, generators.yml),
  // which is the standard Fern project layout.
  await exec.exec("git", ["add", "fern/"]);

  // Check if there are actually changes to commit
  const diffResult = await exec.exec("git", ["diff", "--cached", "--quiet"], {
    ignoreReturnCode: true,
  });
  if (diffResult === 0) {
    core.info("No file changes detected after upgrade. Skipping PR.");
    return "";
  }

  await exec.exec("git", ["commit", "-m", commitMsg]);

  // Force-push the clean-slate branch.
  // We use --force (not --force-with-lease) because the local branch was just created
  // fresh from origin/<default> with no prior tracking ref. --force-with-lease would
  // reject the push when a remote fern/upgrade already exists from a previous run.
  // This is intentional: the clean-slate model resets the branch each run.
  await exec.exec("git", ["push", "--force", "origin", `HEAD:${UPGRADE_BRANCH}`]);

  // Create or update the PR
  const existingPrs = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${UPGRADE_BRANCH}`,
    base: defaultBranch,
    state: "open",
  });

  let prUrl: string;

  if (existingPrs.data.length > 0) {
    const pr = existingPrs.data[0];
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: pr.number,
      title: prTitle,
      body: prBody,
    });
    prUrl = pr.html_url;
    core.info(`Updated existing PR: ${prUrl}`);
  } else {
    const { data: newPr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: UPGRADE_BRANCH,
      base: defaultBranch,
    });
    prUrl = newPr.html_url;
    core.info(`Created new PR: ${prUrl}`);
  }

  return prUrl;
}

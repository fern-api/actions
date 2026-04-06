import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function pushDiffBranch({
  sdkRepo,
  outputPath,
  prNumber,
  githubToken,
}: {
  sdkRepo: string;
  outputPath: string;
  prNumber: number;
  githubToken: string;
}): Promise<string | undefined> {
  if (!fs.existsSync(outputPath)) {
    core.warning(`Output path does not exist: ${outputPath}`);
    return undefined;
  }

  const entries = fs.readdirSync(outputPath);
  if (entries.length === 0) {
    core.warning(`Output path is empty: ${outputPath}`);
    return undefined;
  }

  const branchName = `fern-preview-pr-${prNumber}`;
  const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-diff-"));
  const cloneUrl = `https://x-access-token:${githubToken}@github.com/${sdkRepo}.git`;

  try {
    // Clone target SDK repo (shallow) — silent to avoid logging the token
    await exec.exec("git", ["clone", cloneUrl, cloneDir, "--depth", "1"], {
      silent: true,
    });

    // Determine default branch
    let defaultBranch = "main";
    let refOutput = "";
    const refExitCode = await exec.exec(
      "git",
      ["-C", cloneDir, "symbolic-ref", "refs/remotes/origin/HEAD"],
      {
        listeners: {
          stdout: (data: Buffer) => {
            refOutput += data.toString();
          },
        },
        ignoreReturnCode: true,
      }
    );
    if (refExitCode === 0 && refOutput.trim()) {
      defaultBranch = refOutput.trim().replace("refs/remotes/origin/", "");
    }

    // Create preview branch
    await exec.exec("git", ["-C", cloneDir, "checkout", "-b", branchName]);

    // Remove existing files except protected ones
    const protectedNames = new Set([".git", ".github", ".gitignore", ".fernignore"]);
    const existingEntries = fs.readdirSync(cloneDir);
    for (const entry of existingEntries) {
      if (!protectedNames.has(entry)) {
        fs.rmSync(path.join(cloneDir, entry), { recursive: true, force: true });
      }
    }

    // Copy generated files into the clone
    fs.cpSync(outputPath, cloneDir, { recursive: true });

    // Configure git for commit
    await exec.exec("git", ["-C", cloneDir, "config", "user.name", "fern-preview[bot]"]);
    await exec.exec("git", ["-C", cloneDir, "config", "user.email", "noreply@buildwithfern.com"]);

    // Stage all changes
    await exec.exec("git", ["-C", cloneDir, "add", "-A"]);

    // Check for changes
    const diffExitCode = await exec.exec("git", ["-C", cloneDir, "diff", "--cached", "--quiet"], {
      ignoreReturnCode: true,
    });

    if (diffExitCode === 0) {
      core.info(`No SDK changes detected for ${sdkRepo}`);
      return undefined;
    }

    // Commit and push — silent to avoid logging the token in the remote URL
    await exec.exec("git", ["-C", cloneDir, "commit", "-m", `SDK Preview for PR #${prNumber}`]);
    await exec.exec("git", ["-C", cloneDir, "push", "-f", "origin", branchName], {
      silent: true,
    });

    const diffUrl = `https://github.com/${sdkRepo}/compare/${defaultBranch}...${branchName}`;
    core.info(`SDK diff pushed: ${diffUrl}`);
    return diffUrl;
  } finally {
    // Cleanup
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }
}

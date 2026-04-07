import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

export const REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

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
  if (!REPO_PATTERN.test(sdkRepo)) {
    core.warning(`Invalid SDK repo format: '${sdkRepo}' — expected 'owner/repo'`);
    return undefined;
  }

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
    await gitExec(["clone", cloneUrl, cloneDir, "--depth", "1"], { silent: true });

    // Determine default branch via ls-remote (shallow clones don't have
    // refs/remotes/origin/HEAD, so git symbolic-ref won't work)
    let defaultBranch = "main";
    let lsRemoteOutput = "";
    const lsRemoteExitCode = await gitExec(["ls-remote", "--symref", "origin", "HEAD"], {
      cwd: cloneDir,
      listeners: {
        stdout: (data: Buffer) => {
          lsRemoteOutput += data.toString();
        },
      },
      silent: true,
      ignoreReturnCode: true,
    });
    if (lsRemoteExitCode === 0) {
      // Output format: "ref: refs/heads/main\tHEAD\n..."
      const match = lsRemoteOutput.match(/ref: refs\/heads\/(.+)\t/);
      if (match?.[1]) {
        defaultBranch = match[1];
      }
    }

    // Create preview branch
    await gitExec(["-C", cloneDir, "checkout", "-b", branchName]);

    // Overlay generated files onto the clone. We only overwrite files that
    // the generator produces — non-generated files in the SDK repo (LICENSE,
    // CONTRIBUTING.md, CHANGELOG.md, etc.) are left untouched. The .git
    // directory is always excluded to avoid corrupting the clone.
    fs.cpSync(outputPath, cloneDir, {
      recursive: true,
      filter: (src) => path.basename(src) !== ".git",
    });

    // Configure git for commit
    await gitExec(["-C", cloneDir, "config", "user.name", "fern-preview[bot]"]);
    await gitExec(["-C", cloneDir, "config", "user.email", "noreply@buildwithfern.com"]);

    // Stage all changes
    await gitExec(["-C", cloneDir, "add", "-A"]);

    // Check for changes
    const diffExitCode = await gitExec(["-C", cloneDir, "diff", "--cached", "--quiet"], {
      ignoreReturnCode: true,
    });

    if (diffExitCode === 0) {
      core.info(`No SDK changes detected for ${sdkRepo}`);
      return undefined;
    }

    // Commit and push — silent to avoid logging the token in the remote URL
    await gitExec(["-C", cloneDir, "commit", "-m", `SDK Preview for PR #${prNumber}`]);
    await gitExec(["-C", cloneDir, "push", "-f", "origin", branchName], { silent: true });

    const diffUrl = `https://github.com/${sdkRepo}/compare/${defaultBranch}...${branchName}`;
    core.info(`SDK diff pushed: ${diffUrl}`);
    return diffUrl;
  } finally {
    // Cleanup
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }
}

/** Strips embedded credentials from error messages to prevent token leakage. */
export function sanitizeTokenFromMessage(message: string): string {
  return message.replace(/x-access-token:[^@]+@/g, "x-access-token:***@");
}

/**
 * Wrapper around exec.exec("git", ...) that sanitizes error messages to
 * prevent token leakage. If a git command fails, the Error may contain the
 * full command string including embedded credentials in the clone URL.
 */
async function gitExec(args: string[], options?: exec.ExecOptions): Promise<number> {
  try {
    return await exec.exec("git", args, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitized = sanitizeTokenFromMessage(message);
    throw new Error(sanitized);
  }
}

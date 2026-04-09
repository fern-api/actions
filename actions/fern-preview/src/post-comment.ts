import * as core from "@actions/core";
import * as github from "@actions/github";
import type { PreviewResult } from "./run-preview.js";

const COMMENT_MARKER = "<!-- fern-sdk-preview -->";

export async function postOrUpdateComment({
  results,
  prNumber,
}: {
  results: PreviewResult[];
  prNumber: number;
}): Promise<void> {
  // Use the default GITHUB_TOKEN for posting comments to the current repo.
  // This token is automatically available in GitHub Actions and has write
  // access to the repo where the workflow runs — no cross-repo token needed.
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN environment variable is not set. " +
        "Ensure the workflow has `permissions: pull-requests: write` or passes GITHUB_TOKEN."
    );
  }
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  const body = formatComment(results);

  // Paginate through all comments to find the marker
  const existing = await findExistingComment(octokit, owner, repo, prNumber);

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing,
      body,
    });
    core.info(`Updated existing PR comment (id: ${existing})`);
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    core.info("Created new PR comment");
  }
}

async function findExistingComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<number | undefined> {
  for await (const response of octokit.paginate.iterator(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  })) {
    const match = response.data.find((c) => c.body?.includes(COMMENT_MARKER));
    if (match) {
      return match.id;
    }
  }
  return undefined;
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

export function formatComment(results: PreviewResult[]): string {
  let rows = "";

  for (const result of results) {
    if (result.status === "error") {
      rows += `| ${escapeTableCell(result.groupName)} | :x: Failed | — | — |\n`;
      continue;
    }

    const installCell = result.installCommand
      ? `<code>${escapeTableCell(result.installCommand)}</code>`
      : "—";

    const diffCell = result.diffUrl ? `[View diff](${result.diffUrl})` : "—";

    rows += `| ${escapeTableCell(result.groupName)} | ${escapeTableCell(result.packageName ?? "—")} | ${installCell} | ${diffCell} |\n`;
  }

  // Append error details at the bottom
  const errors = results.filter((r) => r.status === "error" && r.error);
  let errorSection = "";
  if (errors.length > 0) {
    errorSection = "\n### Errors\n\n";
    for (const err of errors) {
      errorSection += `**${err.groupName}**: ${err.error}\n\n`;
    }
  }

  return `${COMMENT_MARKER}
## SDK Preview

| Group | Package | Install | SDK Diff |
|-------|---------|---------|----------|
${rows}${errorSection}
<sub>Published by <a href="https://github.com/fern-api/actions">fern-preview</a></sub>
`;
}

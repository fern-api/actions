import * as core from "@actions/core";
import * as github from "@actions/github";
import type { PreviewResult } from "./run-preview.js";

const COMMENT_MARKER = "<!-- fern-sdk-preview -->";

export async function postOrUpdateComment({
  results,
  githubToken,
  prNumber,
}: {
  results: PreviewResult[];
  githubToken: string;
  prNumber: number;
}): Promise<void> {
  const octokit = github.getOctokit(githubToken);
  const { owner, repo } = github.context.repo;

  const body = formatComment(results);

  // Find existing comment by marker
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated existing PR comment (id: ${existing.id})`);
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

function formatComment(results: PreviewResult[]): string {
  let rows = "";

  for (const result of results) {
    if (result.status === "error") {
      rows += `| ${result.groupName} | :x: Failed | — | — |\n`;
      continue;
    }

    const installCell = result.installCommand ? `\`${result.installCommand}\`` : "—";

    const diffCell = result.diffUrl ? `[View diff](${result.diffUrl})` : "No changes";

    rows += `| ${result.groupName} | ${result.packageName ?? "—"} | ${installCell} | ${diffCell} |\n`;
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
<sub>Published by <a href="https://github.com/fern-api/fern-github-actions">fern-preview</a></sub>
`;
}

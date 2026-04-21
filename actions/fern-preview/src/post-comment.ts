import * as core from "@actions/core";
import * as github from "@actions/github";
import type { PreviewResult } from "./run-preview.js";

const COMMENT_MARKER = "<!-- fern-sdk-preview -->";

export async function postOrUpdateComment({
  results,
  prNumber,
  token,
}: {
  results: PreviewResult[];
  prNumber: number;
  token: string;
}): Promise<void> {
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

/** Escape markdown special characters in user-facing text to prevent injection. */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!~<>|])/g, "\\$1");
}

/** Only allow https:// URLs for diff links to prevent markdown/script injection. */
function sanitizeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }
  return undefined;
}

export function formatComment(results: PreviewResult[]): string {
  let rows = "";

  for (const result of results) {
    if (result.status === "error") {
      rows += `| ${escapeTableCell(result.groupName)} | :x: Failed | — |\n`;
      continue;
    }

    const sanitizedDiffUrl = result.diffUrl ? sanitizeUrl(result.diffUrl) : undefined;
    const diffCell = sanitizedDiffUrl ? `[Preview changes](${sanitizedDiffUrl})` : "—";

    rows += `| ${escapeTableCell(result.groupName)} | :white_check_mark: Published | ${escapeTableCell(diffCell)} |\n`;
  }

  // Build install command sections below the table — code blocks render
  // with GitHub's built-in copy button so users can click to copy.
  let installSection = "";
  const successResults = results.filter((r) => r.status === "success" && r.installCommand);
  if (successResults.length > 0) {
    installSection = "\n### Test install your SDK\n\n";
    for (const result of successResults) {
      if (successResults.length > 1) {
        installSection += `**${escapeMarkdown(result.groupName)}**\n`;
      }
      installSection += `\`\`\`sh\n${result.installCommand}\n\`\`\`\n\n`;
    }
  }

  // Append error details at the bottom
  const errors = results.filter((r) => r.status === "error" && r.error);
  let errorSection = "";
  if (errors.length > 0) {
    errorSection = "### Errors\n\n";
    for (const err of errors) {
      errorSection += `**${escapeMarkdown(err.groupName)}**: ${escapeMarkdown(err.error ?? "Unknown error")}\n\n`;
    }
  }

  const updatedAt = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");

  return `${COMMENT_MARKER}
## SDK Preview

| Group | Status | Preview changes |
|-------|--------|-----------------|
${rows}${installSection}${errorSection}
<sub>Published by <a href="https://github.com/fern-api/actions">fern-preview</a> · Last updated ${updatedAt}</sub>
`;
}

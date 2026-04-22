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
  const successResults = results.filter((r) => r.status === "success");
  const errorResults = results.filter((r) => r.status === "error");
  let sections = "";
  for (const result of successResults) {
    if (result.status !== "success") {
      continue;
    }

    sections += `### ${escapeMarkdown(result.groupName)}\n\n`;

    const sanitizedDiffUrl = result.diffUrl ? sanitizeUrl(result.diffUrl) : undefined;
    if (sanitizedDiffUrl) {
      sections += `[Preview changes](${sanitizedDiffUrl})\n\n`;
    }

    if (result.installCommand) {
      sections += `\`\`\`sh\n${result.installCommand}\n\`\`\`\n\n`;
    }
  }

  // Append error details at the bottom
  let errorSection = "";
  if (errorResults.length > 0) {
    errorSection = "### Errors\n\n";
    for (const err of errorResults) {
      errorSection += `**${escapeMarkdown(err.groupName)}**: ${escapeMarkdown(err.error ?? "Unknown error")}\n\n`;
    }
  }

  // Build collapsible AI prompt with all install commands
  let aiPromptSection = "";
  const installableResults = successResults.filter(
    (r) => r.status === "success" && r.installCommand
  );
  if (installableResults.length > 0) {
    const installLines = installableResults
      .map((r) => {
        if (r.status !== "success") {
          return "";
        }
        return `- ${r.groupName}: ${r.installCommand}`;
      })
      .join("\n");

    const promptText = `Install the following preview SDK packages and run the test suite to verify nothing breaks:\n\n${installLines}`;

    aiPromptSection = `<details>
<summary>🤖 AI prompt</summary>

\`\`\`text
${promptText}
\`\`\`

</details>\n\n`;
  }

  const updatedAt = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");

  return `${COMMENT_MARKER}
## SDK Preview

${sections}${errorSection}${aiPromptSection}
<sub>Published by <a href="https://github.com/fern-api/actions">preview</a> · Last updated ${updatedAt}</sub>
`;
}

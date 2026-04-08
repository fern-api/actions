import * as core from "@actions/core";

const FIDDLE_ORIGIN =
  process.env.FERN_FIDDLE_ORIGIN ??
  process.env.DEFAULT_FIDDLE_ORIGIN ??
  "https://fiddle-coordinator.buildwithfern.com";

/**
 * Requests a short-lived GitHub App installation token from the Fern backend
 * for the given repository. The Fern GitHub App must be installed on the repo.
 *
 * This matches how `fern generate` works — the user provides their fern-token
 * and the backend mints a scoped GitHub installation token server-side.
 */
export async function getGithubInstallationToken({
  owner,
  repo,
  fernToken,
}: {
  owner: string;
  repo: string;
  fernToken: string;
}): Promise<string> {
  const url = `${FIDDLE_ORIGIN}/api/github/installation-token`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${fernToken}`,
    },
    body: JSON.stringify({ owner, repo }),
  });

  if (!response.ok) {
    let errorMessage: string;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      errorMessage = body.message ?? body.error ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }

    if (response.status === 404) {
      throw new Error(
        `Fern GitHub App is not installed on ${owner}/${repo}. Install it at https://github.com/apps/fern-api to enable SDK preview diffs.`
      );
    }

    throw new Error(
      `Failed to get GitHub installation token for ${owner}/${repo}: ${errorMessage}`
    );
  }

  const body = (await response.json()) as { token: string };
  if (!body.token) {
    throw new Error(`Empty token returned for ${owner}/${repo}`);
  }

  core.setSecret(body.token);
  return body.token;
}

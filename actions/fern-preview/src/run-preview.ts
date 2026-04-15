import * as core from "@actions/core";
import * as exec from "@actions/exec";

const PREVIEW_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface PreviewResult {
  status: "success" | "error";
  groupName: string;
  previewId?: string;
  installCommand?: string;
  packageName?: string;
  version?: string;
  registryUrl?: string;
  diffUrl?: string;
  error?: string;
}

interface FernPreviewJson {
  status: "success" | "error";
  org?: string;
  message?: string;
  previews?: Array<{
    preview_id: string;
    install: string;
    version: string;
    package_name: string;
    registry_url: string;
    diff_url?: string;
  }>;
}

export async function runPreview({
  groupName,
  apiName,
  fernToken,
  pushDiff,
}: {
  groupName: string;
  apiName: string | undefined;
  fernToken: string;
  pushDiff: boolean;
}): Promise<PreviewResult> {
  const args = ["sdk", "preview", "--json", "--group", groupName];
  if (apiName) {
    args.push("--api", apiName);
  }
  if (pushDiff) {
    args.push("--push-diff");
  }

  let stdout = "";
  let stderr = "";
  const exitCode = await withTimeout(
    exec.exec("fern", args, {
      env: {
        ...process.env,
        FERN_TOKEN: fernToken,
        FERN_NO_VERSION_REDIRECTION: "true",
      },
      listeners: {
        stdout: (data: Buffer) => {
          stdout += data.toString();
        },
        stderr: (data: Buffer) => {
          stderr += data.toString();
        },
      },
      ignoreReturnCode: true,
    }),
    PREVIEW_TIMEOUT_MS,
    `fern sdk preview timed out after ${PREVIEW_TIMEOUT_MS / 60000} minutes`
  );

  // Parse JSON from stdout. The CLI writes a JSON object but may also emit
  // log lines before/after it. Try clean parse first, then fall back to
  // scanning lines from the end for the start of a JSON object.
  const parsed = parseJsonFromOutput(stdout, groupName);

  if (exitCode !== 0 || parsed?.status === "error" || !parsed) {
    return {
      status: "error",
      groupName,
      error: (parsed?.message ?? stderr.trim()) || `Exit code ${exitCode}`,
    };
  }

  // The action invokes fern sdk preview once per group with a single generator,
  // so we expect exactly one preview entry. If the CLI ever returns multiple
  // entries per invocation, this will need to return an array.
  const preview = parsed.previews?.[0];
  if (!preview) {
    return {
      status: "error",
      groupName,
      error: "No preview entries in output",
    };
  }

  return {
    status: "success",
    groupName,
    previewId: preview.preview_id,
    installCommand: preview.install,
    packageName: preview.package_name,
    version: preview.version,
    registryUrl: preview.registry_url,
    diffUrl: preview.diff_url,
  };
}

/**
 * Extracts a JSON object from stdout that may contain non-JSON log lines.
 * Tries JSON.parse(stdout) first (clean output), then falls back to scanning
 * lines from the end looking for lines that start with '{' and trying to parse
 * from there. This handles both pretty-printed and compact JSON, as well as
 * braces inside string values.
 */
export function parseJsonFromOutput(
  stdout: string,
  groupName: string
): FernPreviewJson | undefined {
  // Happy path: stdout is clean JSON
  try {
    return JSON.parse(stdout.trim()) as FernPreviewJson;
  } catch {
    // Expected when log lines are mixed in
  }

  // Fallback: find lines that look like the start of a JSON object and try
  // to parse from there to the end. The CLI writes the JSON object starting
  // on its own line, so we scan backwards for lines beginning with '{'.
  // We also scan backwards for the closing '}' to handle trailing log lines.
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith("{")) {
      // Try parsing from this line to each '}' line, scanning from the end
      for (let j = lines.length - 1; j >= i; j--) {
        if (lines[j].trimEnd().endsWith("}")) {
          try {
            const candidate = lines.slice(i, j + 1).join("\n");
            return JSON.parse(candidate) as FernPreviewJson;
          } catch {
            // Not valid JSON for this range — keep scanning
          }
        }
      }
    }
  }

  core.warning(`Failed to parse preview output for group '${groupName}'`);
  return undefined;
}

// Note: withTimeout rejects the wrapping promise on timeout but does NOT kill the
// underlying child process spawned by exec.exec. The Node.js event loop stays alive
// until the child exits on its own. The GitHub Actions job-level timeout is the real
// safety net; this timeout primarily provides better error reporting in the PR comment.
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

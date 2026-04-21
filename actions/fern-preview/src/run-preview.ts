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

/**
 * Runs `fern sdk preview --json --group <name>` for a single group.
 * The CLI routes the request through Fiddle for remote generation.
 */
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
  core.setSecret(fernToken);

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

  // Parse JSON from CLI output. The CLI writes JSON via process.stdout.write(),
  // but due to version redirection and process spawning, the JSON may end up in
  // stderr instead. Try stdout first, then fall back to stderr.
  const parsed = extractJsonFromOutput(stdout) ?? extractJsonFromOutput(stderr);
  if (!parsed) {
    core.warning(`Failed to parse preview output for group '${groupName}'`);
  }

  if (exitCode !== 0 || parsed?.status === "error" || !parsed) {
    return {
      status: "error",
      groupName,
      error: truncate((parsed?.message ?? stderr.trim()) || `Exit code ${exitCode}`, 500),
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
 * Extracts a JSON object from output that may contain non-JSON log lines.
 * Tries JSON.parse first (clean output), then falls back to scanning
 * lines from the end looking for lines that start with '{' and trying to parse
 * from there. Validates the parsed object has a 'status' field to avoid
 * matching inner JSON fragments (e.g., individual preview entries).
 */
export function extractJsonFromOutput(output: string): FernPreviewJson | undefined {
  if (!output.trim()) {
    return undefined;
  }

  // Happy path: output is clean JSON
  try {
    const obj = JSON.parse(output.trim()) as FernPreviewJson;
    if (typeof obj.status === "string") {
      return obj;
    }
  } catch {
    // Expected when log lines are mixed in
  }

  // Fallback: find lines that look like the start of a JSON object and try
  // to parse from there to the end. The CLI writes the JSON object starting
  // on its own line, so we scan backwards for lines beginning with '{'.
  // We also scan backwards for the closing '}' to handle trailing log lines.
  const lines = output.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith("{")) {
      // Try parsing from this line to each '}' line, scanning from the end
      for (let j = lines.length - 1; j >= i; j--) {
        if (lines[j].trimEnd().endsWith("}")) {
          try {
            const candidate = lines.slice(i, j + 1).join("\n");
            const obj = JSON.parse(candidate) as FernPreviewJson;
            if (typeof obj.status === "string") {
              return obj;
            }
          } catch {
            // Not valid JSON for this range — keep scanning
          }
        }
      }
    }
  }

  return undefined;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)} [truncated]`;
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

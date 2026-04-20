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

interface AutomationsPreviewGroupResult {
  groupName: string;
  apiName: string | null;
  status: "success" | "error";
  org?: string;
  previews?: Array<{
    preview_id: string;
    install: string;
    version: string;
    package_name: string;
    registry_url: string;
    diff_url?: string;
  }>;
  error?: string;
}

interface AutomationsPreviewJson {
  results: AutomationsPreviewGroupResult[];
}

/**
 * Runs `fern automations preview --json` which discovers all previewable
 * generator groups and runs SDK preview for each one, returning aggregated
 * results. This replaces the previous detect-groups + per-group runPreview
 * pattern — detection and execution are now handled by the CLI.
 */
export async function runAutomationsPreview({
  fernToken,
  pushDiff,
}: {
  fernToken: string;
  pushDiff: boolean;
}): Promise<PreviewResult[]> {
  core.setSecret(fernToken);

  const args = ["automations", "preview", "--json"];
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
    `fern automations preview timed out after ${PREVIEW_TIMEOUT_MS / 60000} minutes`
  );

  // Parse JSON from CLI output. The CLI writes JSON via process.stdout.write(),
  // but due to version redirection and process spawning, the JSON may end up in
  // stderr instead. Try stdout first, then fall back to stderr.
  const parsed = extractAutomationsJson(stdout) ?? extractAutomationsJson(stderr);
  if (!parsed) {
    core.warning("Failed to parse automations preview output");
    return [
      {
        status: "error",
        groupName: "unknown",
        error: truncate(stderr.trim() || `Exit code ${exitCode}`, 500),
      },
    ];
  }

  return parsed.results.map((result): PreviewResult => {
    if (result.status === "error") {
      return {
        status: "error",
        groupName: result.groupName,
        error: result.error,
      };
    }

    // Take the first preview entry per group (each group currently produces
    // one npm package). If the CLI ever returns multiple entries, this will
    // need to expand into multiple PreviewResult rows.
    const preview = result.previews?.[0];
    if (!preview) {
      return {
        status: "error",
        groupName: result.groupName,
        error: "No preview entries in output",
      };
    }

    return {
      status: "success",
      groupName: result.groupName,
      previewId: preview.preview_id,
      installCommand: preview.install,
      packageName: preview.package_name,
      version: preview.version,
      registryUrl: preview.registry_url,
      diffUrl: preview.diff_url,
    };
  });
}

/**
 * Extracts the `{ results: [...] }` JSON object from CLI output that may
 * contain non-JSON log lines. Tries JSON.parse first (clean output), then
 * falls back to scanning lines from the end looking for JSON blocks.
 */
export function extractAutomationsJson(output: string): AutomationsPreviewJson | undefined {
  if (!output.trim()) {
    return undefined;
  }

  // Happy path: output is clean JSON
  try {
    const obj = JSON.parse(output.trim()) as AutomationsPreviewJson;
    if (Array.isArray(obj.results)) {
      return obj;
    }
  } catch {
    // Expected when log lines are mixed in
  }

  // Fallback: find lines that look like the start of a JSON object and try
  // to parse from there to the end. The CLI writes the JSON object starting
  // on its own line, so we scan backwards for lines beginning with '{'.
  const lines = output.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith("{")) {
      for (let j = lines.length - 1; j >= i; j--) {
        if (lines[j].trimEnd().endsWith("}")) {
          try {
            const candidate = lines.slice(i, j + 1).join("\n");
            const obj = JSON.parse(candidate) as AutomationsPreviewJson;
            if (Array.isArray(obj.results)) {
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

import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

export interface PreviewResult {
  status: "success" | "error";
  groupName: string;
  sdkRepo: string | undefined;
  previewId?: string;
  installCommand?: string;
  packageName?: string;
  version?: string;
  registryUrl?: string;
  outputPath?: string;
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
    output_path?: string;
  }>;
}

export async function runPreview({
  groupName,
  apiName,
  fernToken,
}: {
  groupName: string;
  apiName: string | undefined;
  fernToken: string;
}): Promise<PreviewResult> {
  const outputDir = path.join(
    os.tmpdir(),
    "fern-preview",
    apiName ? `${apiName}-${groupName}` : groupName
  );

  const args = ["sdk", "preview", "--json", "--group", groupName, "--output", outputDir];
  if (apiName) {
    args.push("--api", apiName);
  }

  let stdout = "";
  let stderr = "";
  const exitCode = await exec.exec("fern", args, {
    env: { ...process.env, FERN_TOKEN: fernToken },
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
    ignoreReturnCode: true,
  });

  // Parse JSON from stdout. The CLI writes a JSON object but may also emit
  // log lines before/after it. Try clean parse first, then fall back to
  // extracting the last balanced {...} block via brace counting.
  const parsed = parseJsonFromOutput(stdout, groupName);

  if (exitCode !== 0 || parsed?.status === "error" || !parsed) {
    return {
      status: "error",
      groupName,
      sdkRepo: undefined,
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
      sdkRepo: undefined,
      error: "No preview entries in output",
    };
  }

  return {
    status: "success",
    groupName,
    sdkRepo: undefined,
    previewId: preview.preview_id,
    installCommand: preview.install,
    packageName: preview.package_name,
    version: preview.version,
    registryUrl: preview.registry_url,
    outputPath: preview.output_path,
  };
}

/**
 * Extracts a JSON object from stdout that may contain non-JSON log lines.
 * Tries JSON.parse(stdout) first (clean output), then falls back to finding
 * the last balanced {...} block by counting braces from the end. This handles
 * both pretty-printed and compact JSON.
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

  // Fallback: find the last balanced JSON object by scanning backwards
  try {
    let depth = 0;
    let endPos = -1;

    for (let i = stdout.length - 1; i >= 0; i--) {
      const char = stdout[i];
      if (char === "}") {
        if (depth === 0) {
          endPos = i;
        }
        depth++;
      } else if (char === "{") {
        depth--;
        if (depth === 0 && endPos !== -1) {
          return JSON.parse(stdout.slice(i, endPos + 1)) as FernPreviewJson;
        }
      }
    }
  } catch {
    // Fall through to warning
  }

  core.warning(`Failed to parse preview output for group '${groupName}'`);
  return undefined;
}

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
    sdk_repo?: string;
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

  // Parse JSON output — fern sdk preview --json writes a pretty-printed JSON
  // object to stdout. Log lines may appear before/after it, so we can't just
  // JSON.parse(stdout). We scan lines in reverse for the closing "}" then walk
  // back to the opening "{". This assumes the JSON is pretty-printed (closing
  // brace on its own line) — if the CLI ever emits single-line JSON, this
  // heuristic will need updating.
  let parsed: FernPreviewJson | undefined;
  try {
    const lines = stdout.split("\n");
    let endIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trimEnd() === "}") {
        endIdx = i;
        break;
      }
    }
    if (endIdx !== -1) {
      // Walk backwards to find the matching opening brace line
      let startIdx = endIdx;
      for (let i = endIdx; i >= 0; i--) {
        if (lines[i].trimStart().startsWith("{")) {
          startIdx = i;
          break;
        }
      }
      parsed = JSON.parse(lines.slice(startIdx, endIdx + 1).join("\n")) as FernPreviewJson;
    }
  } catch {
    core.warning(`Failed to parse preview output for group '${groupName}'`);
  }

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
    sdkRepo: preview.sdk_repo,
    previewId: preview.preview_id,
    installCommand: preview.install,
    packageName: preview.package_name,
    version: preview.version,
    registryUrl: preview.registry_url,
    outputPath: preview.output_path,
  };
}

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
  const outputDir = path.join(os.tmpdir(), "fern-preview", groupName);

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

  // Parse JSON output — fern sdk preview --json writes a JSON object to stdout.
  // The output may contain non-JSON log lines, so we find the last top-level
  // JSON object to avoid greedily matching across unrelated braces.
  let parsed: FernPreviewJson | undefined;
  try {
    const lastBrace = stdout.lastIndexOf("{");
    if (lastBrace !== -1) {
      parsed = JSON.parse(stdout.slice(lastBrace)) as FernPreviewJson;
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

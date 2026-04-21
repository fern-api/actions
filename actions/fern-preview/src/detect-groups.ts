import * as core from "@actions/core";
import * as exec from "@actions/exec";

export interface DetectedGroup {
  groupName: string;
  apiName: string | undefined;
}

/**
 * Calls `fern automations list preview --json` to discover previewable
 * generator groups. The CLI is the single source of truth for which
 * generators are eligible — this replaces the previous client-side YAML
 * parsing approach.
 */
export async function detectPreviewGroups({
  fernToken,
}: {
  fernToken: string;
}): Promise<DetectedGroup[]> {
  let stdout = "";
  let stderr = "";

  const exitCode = await exec.exec("fern", ["automations", "list", "preview", "--json"], {
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
  });

  if (exitCode !== 0) {
    core.warning(
      `fern automations list preview exited with code ${exitCode}: ${stderr.trim() || "(no stderr)"}`
    );
    return [];
  }

  const parsed = parseGroupsJson(stdout) ?? parseGroupsJson(stderr);
  if (parsed == null) {
    core.warning("Failed to parse JSON from fern automations list preview output.");
    return [];
  }

  return parsed;
}

interface CliPreviewGroup {
  groupName: string;
  apiName: string | null;
  generator: string;
}

/**
 * Parses the JSON array output from `fern automations list preview --json`.
 * Returns undefined if the output is not valid JSON or not an array.
 */
export function parseGroupsJson(output: string): DetectedGroup[] | undefined {
  const trimmed = output.trim();
  if (!trimmed) {
    return undefined;
  }

  // Happy path: output is clean JSON
  try {
    const arr = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(arr)) {
      return undefined;
    }
    return (arr as CliPreviewGroup[]).map((entry) => ({
      groupName: entry.groupName,
      apiName: entry.apiName ?? undefined,
    }));
  } catch {
    // Output may contain log lines mixed with JSON — try to extract the array
  }

  const match = trimmed.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]) as unknown;
      if (Array.isArray(arr)) {
        return (arr as CliPreviewGroup[]).map((entry) => ({
          groupName: entry.groupName,
          apiName: entry.apiName ?? undefined,
        }));
      }
    } catch {
      // Not valid JSON
    }
  }

  return undefined;
}

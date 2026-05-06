export interface SyncOpenApiArgsInput {
  token: string;
  branch?: string;
  autoMerge: boolean;
}

export interface SyncSpecsArgsInput extends SyncOpenApiArgsInput {
  repository: string;
  sources: string;
}

/**
 * Builds the CLI argv tail for `fern gha pull-spec`.
 */
export function buildPullSpecArgs(inputs: SyncOpenApiArgsInput): string[] {
  const args = ["--token", inputs.token];
  if (inputs.branch) args.push("--branch", inputs.branch);
  if (inputs.autoMerge) args.push("--auto-merge");
  return args;
}

/**
 * Builds the CLI argv tail for `fern gha sync-specs`. Throws if repository or
 * sources are missing — these are required when not pulling from origin.
 */
export function buildSyncSpecsArgs(
  inputs: Partial<SyncSpecsArgsInput> & SyncOpenApiArgsInput
): string[] {
  if (!inputs.repository) {
    throw new Error("'repository' input is required when update_from_source is false.");
  }
  if (!inputs.sources) {
    throw new Error("'sources' input is required when update_from_source is false.");
  }
  const args = [
    "--repository",
    inputs.repository,
    "--sources",
    inputs.sources,
    "--token",
    inputs.token,
  ];
  if (inputs.branch) args.push("--branch", inputs.branch);
  if (inputs.autoMerge) args.push("--auto-merge");
  return args;
}

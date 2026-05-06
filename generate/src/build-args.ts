export interface GenerateArgsInput {
  autoMerge: boolean;
  group?: string;
  api?: string;
  generator?: string;
  version?: string;
}

/**
 * Builds the CLI argv tail for `fern automations generate`.
 * Mirrors the conditional flag logic from the original bash composite.
 */
export function buildGenerateArgs(inputs: GenerateArgsInput): string[] {
  const args: string[] = [];
  if (inputs.group) args.push("--group", inputs.group);
  if (inputs.api) args.push("--api", inputs.api);
  if (inputs.generator) args.push("--generator", inputs.generator);
  if (inputs.version) args.push("--version", inputs.version);
  if (inputs.autoMerge) args.push("--auto-merge");
  return args;
}

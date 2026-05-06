import type { AutomationsUpgradeJson, GeneratorUpgradeEntry } from "./run-upgrade.js";

export interface UpgradeDiff {
  cliFrom: string;
  cliTo: string;
  cliUpgraded: boolean;
  generators: GeneratorUpgradeEntry[];
}

/**
 * Converts the raw CLI JSON output into the internal diff format used for
 * PR title/body/commit message generation.
 */
export function cliJsonToDiff(json: AutomationsUpgradeJson): UpgradeDiff {
  return {
    cliFrom: json.cli.from,
    cliTo: json.cli.to,
    cliUpgraded: json.cli.upgraded,
    generators: json.generators,
  };
}

/**
 * Derives a short generator name from the full Docker image name.
 * "fernapi/fern-typescript-sdk" → "typescript-sdk"
 */
export function getShortGeneratorName(name: string): string {
  return name.replace(/^fernapi\/fern-/, "");
}

/**
 * Derives the changelog URL from a generator name as a fallback when the CLI
 * doesn't provide one. Generator names follow the pattern
 * "fernapi/fern-<language>-sdk[-variant]".
 */
export function getChangelogUrl(name: string): string | undefined {
  const match = name.match(/^fernapi\/fern-([a-z]+)/);
  if (!match?.[1]) {
    return undefined;
  }
  return `https://buildwithfern.com/learn/sdks/generators/${match[1]}/changelog`;
}

/**
 * Builds a concise PR title that won't be truncated by GitHub (~256 char limit).
 */
export function buildPrTitle(diff: UpgradeDiff): string {
  const parts: string[] = [];

  if (diff.cliUpgraded) {
    parts.push(`CLI ${diff.cliFrom} → ${diff.cliTo}`);
  }

  if (diff.generators.length > 0) {
    parts.push(`${diff.generators.length} generator${diff.generators.length === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return "chore(fern): upgrade check (no changes)";
  }

  return `chore(fern): upgrade ${parts.join(" and ")}`;
}

/**
 * Builds a markdown PR body with CLI version change and generator upgrade table.
 */
export function buildPrBody(diff: UpgradeDiff): string {
  const sections: string[] = ["## Fern Upgrade\n"];

  if (diff.cliUpgraded) {
    sections.push(`### CLI\n- \`${diff.cliFrom}\` → \`${diff.cliTo}\`\n`);
  }

  if (diff.generators.length > 0) {
    sections.push("### Generators");
    sections.push("| Generator | From | To | Changelog |");
    sections.push("|-----------|------|----|-----------|");

    for (const g of diff.generators) {
      const changelogUrl = g.changelog ?? getChangelogUrl(g.name);
      const link = changelogUrl ? `[View](${changelogUrl})` : "—";
      sections.push(`| ${g.name} | ${g.from} | ${g.to} | ${link} |`);
    }
    sections.push("");
  }

  sections.push(
    "---\n🤖This PR was automatically created by " +
      "[fern-upgrade](https://github.com/fern-api/actions/tree/main/upgrade)"
  );

  return sections.join("\n");
}

/**
 * Builds a one-line commit message summarizing all version changes.
 */
export function buildCommitMessage(diff: UpgradeDiff): string {
  const parts: string[] = [];

  if (diff.cliUpgraded) {
    parts.push(`cli ${diff.cliFrom} → ${diff.cliTo}`);
  }

  for (const g of diff.generators) {
    parts.push(`${getShortGeneratorName(g.name)} ${g.from} → ${g.to}`);
  }

  if (parts.length === 0) {
    return "chore: fern upgrade check (no changes)";
  }

  return `chore: upgrade fern ${parts.join(", ")}`;
}

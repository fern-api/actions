import * as core from "@actions/core";
import { ProjectConfig } from "../project-config.js";
import { getGithubRunId, getGithubRunUrl, getOrCreateRunId } from "../run-id.js";
import type { TelemetryContext } from "./types.js";

/**
 * Gathers the common payload fields from the GitHub Actions runtime
 * environment. Each FERN_CONFIG_* env var takes precedence over its
 * GITHUB_* counterpart so that values exported by an earlier step in the
 * same workflow chain (e.g. setup-cli exports FERN_CONFIG_REPO; generate
 * inherits it) propagate consistently. In the common single-action case,
 * the FERN_CONFIG_* vars are unset and the fallbacks to GITHUB_REPOSITORY
 * / GITHUB_SHA / etc. provide the values directly.
 */
export function getTelemetryContext(action: string): TelemetryContext {
  const env = process.env;
  const repository = env.FERN_CONFIG_REPO ?? env.GITHUB_REPOSITORY;
  return {
    runId: getOrCreateRunId(),
    githubRunId: getGithubRunId(),
    githubRunUrl: getGithubRunUrl(),
    org: ProjectConfig.tryLoad()?.organization,
    configRepo: repository,
    configCommitSha: env.FERN_CONFIG_COMMIT_SHA ?? env.GITHUB_SHA ?? undefined,
    configBranch: env.FERN_CONFIG_BRANCH ?? env.GITHUB_HEAD_REF ?? env.GITHUB_REF_NAME ?? undefined,
    configPrNumber:
      env.FERN_CONFIG_PR_NUMBER ?? extractPrNumberFromGithubRef(env.GITHUB_REF) ?? undefined,
    trigger: env.GITHUB_EVENT_NAME ?? undefined,
    cliVersion: undefined,
    action: action,
  };
}

/**
 * Exports the FERN_* env vars to the runner so any spawned CLI process
 * inherits the same correlation values the wrapper resolved.
 * Mirrors how `getOrCreateRunId` exports FERN_RUN_ID. Only exports keys whose
 * values are non-empty — leaves unset values alone so the CLI's own fallback
 * logic (`getTelemetryContextFromEnv` in the fern repo) can take over.
 */
export function exportTelemetryContextEnv(context: TelemetryContext): void {
  core.exportVariable("FERN_AUTOMATION", "true");
  core.exportVariable("FERN_ACTION", context.action);
  exportIfPresent("FERN_GITHUB_RUN_URL", context.githubRunUrl);
  exportIfPresent("FERN_CONFIG_REPO", context.configRepo);
  exportIfPresent("FERN_CONFIG_COMMIT_SHA", context.configCommitSha);
  exportIfPresent("FERN_CONFIG_BRANCH", context.configBranch);
  if (context.configPrNumber !== null) {
    exportIfPresent("FERN_CONFIG_PR_NUMBER", context.configPrNumber);
  }
}

function exportIfPresent(name: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    core.exportVariable(name, value);
  }
}

function extractPrNumberFromGithubRef(ref: string | undefined): string | null {
  if (!ref) {
    return null;
  }
  const match = /^refs\/pull\/(\d+)\//.exec(ref);
  return match?.[1] ?? null;
}

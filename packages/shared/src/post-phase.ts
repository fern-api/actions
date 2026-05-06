import * as core from "@actions/core";

/**
 * GitHub Actions calls the same script for the main and post phases when
 * `runs.main` and `runs.post` point at the same file. This helper marks the
 * main phase via GITHUB_STATE so subsequent invocations of the same script
 * can detect they are running as the post step.
 *
 * Usage:
 *   if (isPostPhase()) {
 *     runPostCleanup();
 *     return;
 *   }
 *   markMainPhaseStarted();
 *   // ...main work
 */
const STATE_IS_POST = "fern_is_post";

export function markMainPhaseStarted(): void {
  core.saveState(STATE_IS_POST, "true");
}

export function isPostPhase(): boolean {
  return core.getState(STATE_IS_POST) === "true";
}

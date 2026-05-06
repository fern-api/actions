import * as core from "@actions/core";
import {
  getRequiredFernToken,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("verify-token", async () => {
    getRequiredFernToken();
    core.info("FERN_TOKEN is set.");
  });
});

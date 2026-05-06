import * as core from "@actions/core";
import {
  getOrCreateRunId,
  instrumentAction,
  isPostPhase,
  markMainPhaseStarted,
  resolveFernCli,
  runAction,
  runPostCleanup,
} from "@fern-github-actions/shared";

runAction(async () => {
  if (isPostPhase()) {
    runPostCleanup();
    return;
  }
  markMainPhaseStarted();

  await instrumentAction("resolve-cli", async () => {
    getOrCreateRunId();

    const version = core.getInput("version") || "auto";
    const cli = await resolveFernCli(version);
    core.setOutput("fern-cmd", [cli.command, ...cli.leadingArgs].join(" "));
  });
});

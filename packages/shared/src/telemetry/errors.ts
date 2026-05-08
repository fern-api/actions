/**
 * Thrown by wrapper code (CLI install, CLI run, PR creation, Octokit
 * calls, Slack notification, etc.) to attach a stable error code to a
 * thrown exception. The wrapper's top-level catch reads `errorCode` to
 * populate the `wrapper_failed` event.
 *
 * Codes are SCREAMING_SNAKE_CASE, mirroring the CLI's error taxonomy.
 * Examples: `CLI_INSTALL_NPM_FAILED`, `CLI_AUTOMATIONS_GENERATE_FAILED`,
 * `PR_CREATE_OCTOKIT_403`, `SLACK_NOTIFY_WEBHOOK_5XX`.
 */
export interface WrapperErrorParams {
  errorCode: string;
  message: string;
  originalError?: unknown;
}

export class WrapperError extends Error {
  readonly errorCode: string;
  readonly originalError: unknown;

  constructor({ errorCode, message, originalError }: WrapperErrorParams) {
    super(message);
    this.name = "WrapperError";
    this.errorCode = errorCode;
    this.originalError = originalError ?? null;
  }
}

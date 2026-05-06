export * from "./types.js";
export * from "./run-id.js";
export * from "./telemetry.js";
export * from "./post-phase.js";
export * from "./fern-cli.js";
export * from "./install-cli.js";

import * as core from "@actions/core";
import type { Repository } from "./types.js";

/**
 * Gets a required input, throws if missing.
 */
export function getRequiredInput(name: string): string {
  const value = core.getInput(name, { required: true });
  if (!value) {
    throw new Error(`Input '${name}' is required but was not provided.`);
  }
  return value;
}

const FERN_TOKEN_HELP =
  "FERN_TOKEN is not set. Add it as a repository secret " +
  "(Settings → Secrets and variables → Actions → New repository secret) " +
  "and reference it in your workflow as fern-token: ${{ secrets.FERN_TOKEN }}";

/**
 * Gets the `fern-token` input, throwing the same actionable error message
 * that the verify-token action uses. Also masks the value via `core.setSecret`
 * so it cannot leak into action logs.
 */
export function getRequiredFernToken(): string {
  const value = core.getInput("fern-token");
  if (!value) {
    throw new Error(FERN_TOKEN_HELP);
  }
  core.setSecret(value);
  return value;
}

/**
 * Gets an optional input, returns undefined if missing.
 */
export function getOptionalInput(name: string): string | undefined {
  const value = core.getInput(name);
  return value || undefined;
}

/**
 * Wraps action execution with top-level error handling and core.setFailed.
 */
export async function runAction(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    core.setFailed(message);
    process.exit(1);
  }
}

/**
 * Parses owner/repo from a "owner/repo" string.
 */
export function parseRepository(fullName: string): Repository {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repository format '${fullName}'. Expected 'owner/repo'.`);
  }
  return {
    owner: parts[0],
    name: parts[1],
    fullName,
  };
}

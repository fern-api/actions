export * from "./types.js";

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

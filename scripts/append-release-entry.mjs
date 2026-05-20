#!/usr/bin/env node
/**
 * Prepends a release entry to <action>/RELEASES.md so main carries a
 * human-readable, queryable ledger of every release published through
 * .github/workflows/release.yml.
 *
 * Inputs (env vars):
 *   ACTION          required  e.g. "setup-cli"
 *   VERSION         required  e.g. "v1.0.1"
 *   SRC_SHA         required  full main commit SHA the release was built from
 *   DIST_SHA        required  full dist-branch commit SHA holding the artifact
 *   GH_RELEASE_URL  optional  GitHub Release URL (omitted when run before gh release create)
 *   RELEASE_DATE    optional  YYYY-MM-DD (defaults to today UTC)
 *   REPO_SLUG       optional  defaults to "fern-api/actions"
 *
 * Idempotent: if the top entry already matches ACTION@VERSION, the script
 * exits 0 without modifying the file (lets a retried release skip the
 * append cleanly).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADER = [
  "<!-- AUTO-GENERATED — DO NOT EDIT BY HAND. Managed by .github/workflows/release.yml. -->",
  "<!-- Edits will be overwritten by the next release. -->",
].join("\n");

function require(name) {
  const value = process.env[name];
  if (!value || value.length === 0) {
    console.error(`append-release-entry: missing required env var ${name}`);
    process.exit(1);
  }
  return value;
}

function shorten(sha) {
  return sha.slice(0, 7);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function buildEntry({ action, version, srcSha, distSha, ghReleaseUrl, releaseDate, repoSlug }) {
  const srcShort = shorten(srcSha);
  const distShort = shorten(distSha);
  const lines = [
    `## ${version} — ${releaseDate}`,
    `- Tag: \`${action}/${version}\``,
    `- Source: [\`${srcShort}\`](https://github.com/${repoSlug}/commit/${srcSha}) on main`,
    `- Dist: [\`${distShort}\`](https://github.com/${repoSlug}/commit/${distSha}) on \`dist/${action}\``,
    `- Sentry release: \`${action}@${version}\``,
  ];
  if (ghReleaseUrl) {
    lines.push(`- GitHub Release: ${ghReleaseUrl}`);
  }
  return lines.join("\n");
}

function buildFresh(action, entry) {
  return `${HEADER}\n\n# ${action} releases\n\n${entry}\n`;
}

function prepend(existing, action, version, entry) {
  const heading = `# ${action} releases`;
  const headingIdx = existing.indexOf(heading);
  if (headingIdx === -1) {
    // File exists but is malformed — treat as fresh, log a warning.
    console.warn(
      `append-release-entry: ${action}/RELEASES.md exists but has no '${heading}' marker; rewriting from scratch`
    );
    return buildFresh(action, entry);
  }
  const afterHeading = existing.indexOf("\n", headingIdx) + 1;
  const before = existing.slice(0, afterHeading);
  const rest = existing.slice(afterHeading).replace(/^\n+/, "");

  // Idempotency: if the next entry is already ACTION@VERSION, skip.
  const versionHeading = `## ${version} `;
  if (rest.startsWith(versionHeading)) {
    return null;
  }

  return `${before}\n${entry}\n\n${rest}`;
}

function main() {
  const action = require("ACTION");
  const version = require("VERSION");
  const srcSha = require("SRC_SHA");
  const distSha = require("DIST_SHA");
  const ghReleaseUrl = process.env.GH_RELEASE_URL || "";
  const releaseDate = process.env.RELEASE_DATE || todayUtc();
  const repoSlug = process.env.REPO_SLUG || "fern-api/actions";

  const entry = buildEntry({
    action,
    version,
    srcSha,
    distSha,
    ghReleaseUrl,
    releaseDate,
    repoSlug,
  });

  const filePath = resolve(process.cwd(), action, "RELEASES.md");
  let next;
  if (!existsSync(filePath)) {
    next = buildFresh(action, entry);
  } else {
    const existing = readFileSync(filePath, "utf8");
    const updated = prepend(existing, action, version, entry);
    if (updated === null) {
      console.log(`append-release-entry: ${action}/${version} is already the top entry — no-op`);
      return;
    }
    next = updated;
  }

  writeFileSync(filePath, next);
  console.log(`append-release-entry: wrote ${action}/RELEASES.md (entry for ${action}/${version})`);
}

main();

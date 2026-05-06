/**
 * Normalizes the user's `fern-version` input for installation. Treats empty
 * string and undefined as 'auto'. The Fern CLI handles version redirection at
 * runtime via fern.config.json, so 'auto' just means "install the latest npm
 * release and let the CLI sort it out".
 */
export function normalizeFernVersion(rawVersion: string | undefined): string {
  const version = rawVersion || "auto";
  return version === "auto" ? "latest" : version;
}

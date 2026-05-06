import { describe, expect, it } from "vitest";
import { normalizeFernVersion } from "../src/parse-inputs.js";

describe("normalizeFernVersion", () => {
  it("returns 'latest' when input is 'auto'", () => {
    expect(normalizeFernVersion("auto")).toBe("latest");
  });

  it("returns 'latest' when input is undefined", () => {
    expect(normalizeFernVersion(undefined)).toBe("latest");
  });

  it("returns 'latest' when input is empty string", () => {
    // empty string is falsy, falls through to default 'auto' → 'latest'
    expect(normalizeFernVersion("")).toBe("latest");
  });

  it("preserves an explicit 'latest'", () => {
    expect(normalizeFernVersion("latest")).toBe("latest");
  });

  it("preserves a pinned version", () => {
    expect(normalizeFernVersion("3.98.5")).toBe("3.98.5");
  });

  it("preserves an npm tag like 'beta'", () => {
    expect(normalizeFernVersion("beta")).toBe("beta");
  });
});

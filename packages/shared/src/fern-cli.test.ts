import * as core from "@actions/core";
import * as io from "@actions/io";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveFernCli } from "./fern-cli.js";

vi.mock("@actions/core");
vi.mock("@actions/io");

interface MockedCore {
  exportVariable: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
}

interface MockedIo {
  which: ReturnType<typeof vi.fn>;
}

const mockedCore = core as unknown as MockedCore;
const mockedIo = io as unknown as MockedIo;

describe("resolveFernCli", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns npx fern-api@latest for 'auto' and does NOT set FERN_NO_VERSION_REDIRECTION", async () => {
    const result = await resolveFernCli("auto");
    expect(result).toEqual({ command: "npx", leadingArgs: ["--yes", "fern-api@latest"] });
    expect(mockedCore.exportVariable).not.toHaveBeenCalled();
  });

  it("returns bare 'fern' for 'inherit' when fern is on PATH and disables version redirection", async () => {
    mockedIo.which.mockResolvedValue("/usr/local/bin/fern");
    const result = await resolveFernCli("inherit");
    expect(result).toEqual({ command: "fern", leadingArgs: [] });
    expect(mockedCore.exportVariable).toHaveBeenCalledWith("FERN_NO_VERSION_REDIRECTION", "true");
  });

  it("throws when version='inherit' but fern is not on PATH", async () => {
    mockedIo.which.mockResolvedValue("");
    await expect(resolveFernCli("inherit")).rejects.toThrow(/'inherit' but fern is not on PATH/);
    expect(mockedCore.exportVariable).not.toHaveBeenCalled();
  });

  it("returns pinned version and disables version redirection for any other value", async () => {
    const result = await resolveFernCli("0.15.0");
    expect(result).toEqual({ command: "npx", leadingArgs: ["--yes", "fern-api@0.15.0"] });
    expect(mockedCore.exportVariable).toHaveBeenCalledWith("FERN_NO_VERSION_REDIRECTION", "true");
  });

  it("returns pinned version for npm tags (e.g. 'beta')", async () => {
    const result = await resolveFernCli("beta");
    expect(result).toEqual({ command: "npx", leadingArgs: ["--yes", "fern-api@beta"] });
  });

  it("logs the resolved command", async () => {
    await resolveFernCli("auto");
    expect(mockedCore.info).toHaveBeenCalledWith("Using Fern CLI: npx --yes fern-api@latest");
  });
});

import * as exec from "@actions/exec";
import * as io from "@actions/io";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFernCli } from "./install-cli.js";

vi.mock("@actions/core");
vi.mock("@actions/exec");
vi.mock("@actions/io");

interface MockedExec {
  exec: ReturnType<typeof vi.fn>;
}

interface MockedIo {
  which: ReturnType<typeof vi.fn>;
}

const mockedExec = exec as unknown as MockedExec;
const mockedIo = io as unknown as MockedIo;

describe("installFernCli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIo.which.mockImplementation(async (tool: string) => {
      if (tool === "npm") return "/usr/bin/npm";
      if (tool === "node") return "/usr/bin/node";
      return "";
    });
    // Default: every exec.exec call resolves with exit code 0
    mockedExec.exec.mockResolvedValue(0);
  });

  it("throws when npm is not on PATH", async () => {
    mockedIo.which.mockImplementation(async (tool: string) =>
      tool === "node" ? "/usr/bin/node" : ""
    );
    await expect(installFernCli("latest")).rejects.toThrow(/npm is not available/);
  });

  it("throws when node is not on PATH", async () => {
    mockedIo.which.mockImplementation(async (tool: string) =>
      tool === "npm" ? "/usr/bin/npm" : ""
    );
    await expect(installFernCli("latest")).rejects.toThrow(/node is not available/);
  });

  it("installs unpinned 'fern-api' for version='latest'", async () => {
    await installFernCli("latest");
    expect(mockedExec.exec).toHaveBeenCalledWith("npm", ["install", "-g", "fern-api"]);
  });

  it("installs unpinned 'fern-api' for version='auto'", async () => {
    await installFernCli("auto");
    expect(mockedExec.exec).toHaveBeenCalledWith("npm", ["install", "-g", "fern-api"]);
  });

  it("installs pinned 'fern-api@0.15.0' for a specific version", async () => {
    await installFernCli("0.15.0");
    expect(mockedExec.exec).toHaveBeenCalledWith("npm", ["install", "-g", "fern-api@0.15.0"]);
  });

  it("runs 'fern --version' with FERN_NO_VERSION_REDIRECTION=true after install", async () => {
    await installFernCli("latest");
    const fernVersionCall = mockedExec.exec.mock.calls.find((call) => call[0] === "fern");
    expect(fernVersionCall).toBeDefined();
    expect(fernVersionCall?.[1]).toEqual(["--version"]);
    expect(fernVersionCall?.[2]?.env?.FERN_NO_VERSION_REDIRECTION).toBe("true");
  });
});

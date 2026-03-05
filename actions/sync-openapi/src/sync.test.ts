import { beforeEach, describe, expect, it, vi } from "vitest";

// Use shared state objects so mocks across resetModules don't create circular refs
const state = {
  infoCalls: [] as string[],
  setFailedCalls: [] as string[],
  execCalls: [] as [string, string[] | undefined, unknown][],
  getInputImpl: (_name: string): string => "",
  getBooleanInputImpl: (_name: string): boolean => false,
  execImpl: async (_cmd: string, _args?: string[]): Promise<number> => 0,
  getExecOutputImpl: async (
    _cmd: string,
    _args?: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => ({
    stdout: "",
    stderr: "",
    exitCode: 0,
  }),
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  mockOctokit: null as any,
};

// Shared mock state for octokit calls
let mockPullsList: ReturnType<typeof vi.fn>;
let mockPullsCreate: ReturnType<typeof vi.fn>;
let mockPullsUpdate: ReturnType<typeof vi.fn>;
let mockGitGetRef: ReturnType<typeof vi.fn>;
let mockIssuesCreateComment: ReturnType<typeof vi.fn>;
let mockReposGet: ReturnType<typeof vi.fn>;

// Factory mocks that delegate to shared state
vi.mock("@actions/core", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  getInput: vi.fn((...args: any[]) => state.getInputImpl(args[0])),
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  getBooleanInput: vi.fn((...args: any[]) => state.getBooleanInputImpl(args[0])),
  info: vi.fn((msg: string) => {
    state.infoCalls.push(msg);
  }),
  setFailed: vi.fn((msg: string) => {
    state.setFailedCalls.push(msg);
  }),
  warning: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(() => state.mockOctokit),
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    ref: "refs/heads/main",
  },
}));

vi.mock("@actions/exec", () => ({
  exec: vi.fn(async (cmd: string, args?: string[], opts?: unknown): Promise<number> => {
    state.execCalls.push([cmd, args, opts]);
    return state.execImpl(cmd, args);
  }),
  getExecOutput: vi.fn(async (cmd: string, args?: string[], opts?: unknown) => {
    state.execCalls.push([cmd, args, opts]);
    return state.getExecOutputImpl(cmd, args);
  }),
}));

vi.mock("@actions/io", () => ({
  mkdirP: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
  copyFileSync: vi.fn(),
}));

function setupMocks({
  hasChanges = true,
  existingPRNumber = null as number | null,
  branchExists = false,
  autoMerge = false,
}: {
  hasChanges?: boolean;
  existingPRNumber?: number | null;
  branchExists?: boolean;
  autoMerge?: boolean;
} = {}) {
  // Reset shared state
  state.infoCalls = [];
  state.setFailedCalls = [];
  state.execCalls = [];

  // Setup input implementations
  state.getInputImpl = (name: string): string => {
    const inputs: Record<string, string> = {
      token: "fake-token",
      branch: "update-api",
      auto_merge: "false",
      update_from_source: "true",
    };
    return inputs[name] || "";
  };
  state.getBooleanInputImpl = (name: string): boolean => {
    if (name === "auto_merge") return autoMerge;
    if (name === "update_from_source") return true;
    return false;
  };

  // Setup exec implementations
  state.execImpl = async (_cmd: string, _args?: string[]) => 0;
  state.getExecOutputImpl = async (_cmd: string, _args?: string[]) => ({
    stdout: hasChanges ? "M openapi/openapi.json\n" : "",
    stderr: "",
    exitCode: 0,
  });

  // Setup GitHub octokit mocks
  mockPullsList = vi.fn().mockResolvedValue({
    data: existingPRNumber ? [{ number: existingPRNumber }] : [],
  });
  mockPullsCreate = vi.fn().mockResolvedValue({
    data: { html_url: "https://github.com/test-owner/test-repo/pull/1" },
  });
  mockPullsUpdate = vi.fn().mockResolvedValue({});
  mockIssuesCreateComment = vi.fn().mockResolvedValue({});
  mockReposGet = vi.fn().mockResolvedValue({});
  mockGitGetRef = branchExists
    ? vi.fn().mockResolvedValue({})
    : vi.fn().mockRejectedValue(new Error("Not found"));

  state.mockOctokit = {
    rest: {
      pulls: {
        list: mockPullsList,
        create: mockPullsCreate,
        update: mockPullsUpdate,
      },
      git: { getRef: mockGitGetRef },
      issues: { createComment: mockIssuesCreateComment },
      repos: { get: mockReposGet },
    },
  };
}

async function importAndRun() {
  vi.resetModules();

  const { run } = await import("./sync");
  await run();
}

function setupMocksForTargetSpec({
  repository = "target-owner/target-repo",
  hasChanges = true,
  existingPRNumber = null as number | null,
  branchExists = false,
  autoMerge = false,
}: {
  repository?: string;
  hasChanges?: boolean;
  existingPRNumber?: number | null;
  branchExists?: boolean;
  autoMerge?: boolean;
} = {}) {
  setupMocks({ hasChanges, existingPRNumber, branchExists, autoMerge });

  state.getInputImpl = (name: string): string => {
    const inputs: Record<string, string> = {
      token: "fake-token",
      branch: "update-api",
      repository,
      sources: '[{"from": "openapi/openapi.json", "to": "openapi/openapi.json"}]',
    };
    return inputs[name] || "";
  };
  state.getBooleanInputImpl = (name: string): boolean => {
    if (name === "auto_merge") return autoMerge;
    if (name === "update_from_source") return false;
    return false;
  };

  // git status --porcelain returns changes or not
  state.getExecOutputImpl = async (_cmd: string, _args?: string[]) => ({
    stdout: hasChanges ? "M openapi/openapi.json\n" : "",
    stderr: "",
    exitCode: 0,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.infoCalls = [];
  state.setFailedCalls = [];
  state.execCalls = [];
});

describe("updateFromSourceSpec", () => {
  describe("when changes are detected and no existing PR", () => {
    it("should create a new PR", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: null });
      await importAndRun();

      expect(mockPullsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          head: "update-api",
          base: "main",
        })
      );
    });

    it("should check for existing PRs before creating", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: null });
      await importAndRun();

      expect(mockPullsList).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          head: "test-owner:update-api",
          state: "open",
        })
      );

      expect(mockPullsCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("when changes are detected and an existing PR exists", () => {
    it("should NOT create a new PR", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: 42 });
      await importAndRun();

      expect(mockPullsList).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          head: "test-owner:update-api",
          state: "open",
        })
      );

      expect(mockPullsCreate).not.toHaveBeenCalled();
    });

    it("should log that the existing PR was reused", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: 42 });
      await importAndRun();

      expect(state.infoCalls).toEqual(
        expect.arrayContaining([expect.stringContaining("PR #42 already exists")])
      );
    });
  });

  describe("when no changes are detected", () => {
    it("should not push or create a PR", async () => {
      setupMocks({ hasChanges: false });
      await importAndRun();

      expect(mockPullsCreate).not.toHaveBeenCalled();
      expect(state.infoCalls).toContain(
        "No changes detected from fern api update. Skipping further actions."
      );
    });
  });

  describe("git push behavior", () => {
    it("should push without --force flag", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: null });
      await importAndRun();

      const pushCall = state.execCalls.find(
        ([cmd, args]) => cmd === "git" && Array.isArray(args) && args.includes("push")
      );

      expect(pushCall).toBeDefined();
      expect(pushCall?.[1]).not.toContain("--force");
      expect(pushCall?.[1]).toContain("--verbose");
      expect(pushCall?.[1]).toContain("origin");
      expect(pushCall?.[1]).toContain("update-api");
    });

    it("should rebase and retry push when regular push fails", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: null });
      let pushAttempt = 0;
      state.execImpl = async (cmd: string, args?: string[]): Promise<number> => {
        if (cmd === "git" && Array.isArray(args) && args.includes("push")) {
          pushAttempt++;
          if (pushAttempt === 1) {
            throw new Error("rejected (non-fast-forward)");
          }
        }
        return 0;
      };
      state.getExecOutputImpl = async (cmd: string, args?: string[]) => {
        if (cmd === "git" && Array.isArray(args) && args.includes("--porcelain")) {
          return { stdout: "M openapi/openapi.json\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };
      await importAndRun();

      const rebasePull = state.execCalls.find(
        ([cmd, args]) =>
          cmd === "git" && Array.isArray(args) && args.includes("pull") && args.includes("--rebase")
      );
      expect(rebasePull).toBeDefined();
      expect(mockPullsCreate).toHaveBeenCalledTimes(1);
    });

    it("should comment on PR when push and rebase both fail", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: 42 });
      state.execImpl = async (cmd: string, args?: string[]): Promise<number> => {
        if (cmd === "git" && Array.isArray(args) && args.includes("push")) {
          throw new Error("rejected (non-fast-forward)");
        }
        return 0;
      };
      state.getExecOutputImpl = async (cmd: string, args?: string[]) => {
        if (cmd === "git" && Array.isArray(args) && args.includes("--porcelain")) {
          return { stdout: "M openapi/openapi.json\n", stderr: "", exitCode: 0 };
        }
        if (
          cmd === "git" &&
          Array.isArray(args) &&
          args.includes("pull") &&
          args.includes("--rebase")
        ) {
          return {
            stdout: "CONFLICT (content): Merge conflict in fern/openapi/openapi.json",
            stderr: "error: could not apply abc1234... Update API",
            exitCode: 1,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };
      await importAndRun();

      expect(mockPullsCreate).not.toHaveBeenCalled();
      expect(mockIssuesCreateComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 42,
        })
      );

      const commentCall = mockIssuesCreateComment.mock.calls[0][0];
      expect(commentCall.body).toContain("Sync failed");
      expect(commentCall.body).toContain("merge conflicts");
      expect(commentCall.body).toContain("Rebase error:");
      expect(commentCall.body).toContain("```");
      expect(commentCall.body).toContain("CONFLICT (content)");
      expect(commentCall.body).toContain("could not apply");

      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([expect.stringContaining("conflicts")])
      );
    });

    it("should label as 'Push error' when rebase succeeds but post-rebase push fails", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: 42 });
      state.execImpl = async (cmd: string, args?: string[]): Promise<number> => {
        if (cmd === "git" && Array.isArray(args) && args.includes("push")) {
          throw new Error("rejected (non-fast-forward)");
        }
        return 0;
      };
      state.getExecOutputImpl = async (cmd: string, args?: string[]) => {
        if (cmd === "git" && Array.isArray(args) && args.includes("--porcelain")) {
          return { stdout: "M openapi/openapi.json\n", stderr: "", exitCode: 0 };
        }
        if (
          cmd === "git" &&
          Array.isArray(args) &&
          args.includes("pull") &&
          args.includes("--rebase")
        ) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd === "git" && Array.isArray(args) && args.includes("push")) {
          return { stdout: "", stderr: "remote rejected", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };
      await importAndRun();

      const commentCall = mockIssuesCreateComment.mock.calls[0][0];
      expect(commentCall.body).toContain("Push error:");
      expect(commentCall.body).not.toContain("Rebase error:");
      expect(commentCall.body).toContain("push rejection after successful rebase");
      expect(commentCall.body).not.toContain("merge conflicts");

      const abortCall = state.execCalls.find(
        ([cmd, args]) =>
          cmd === "git" &&
          Array.isArray(args) &&
          args.includes("rebase") &&
          args.includes("--abort")
      );
      expect(abortCall).toBeUndefined();
    });

    it("should call setFailed when push fails and no existing PR to comment on", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: null });
      state.execImpl = async (cmd: string, args?: string[]): Promise<number> => {
        if (cmd === "git" && Array.isArray(args) && args.includes("push")) {
          throw new Error("rejected (non-fast-forward)");
        }
        return 0;
      };
      state.getExecOutputImpl = async (cmd: string, args?: string[]) => {
        if (cmd === "git" && Array.isArray(args) && args.includes("--porcelain")) {
          return { stdout: "M openapi/openapi.json\n", stderr: "", exitCode: 0 };
        }
        if (
          cmd === "git" &&
          Array.isArray(args) &&
          args.includes("pull") &&
          args.includes("--rebase")
        ) {
          return { stdout: "", stderr: "merge conflict", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };
      await importAndRun();

      expect(mockPullsCreate).not.toHaveBeenCalled();
      expect(mockIssuesCreateComment).not.toHaveBeenCalled();
      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([expect.stringContaining("Failed to push changes")])
      );
    });

    it("should include rebase abort error in PR comment when abort fails", async () => {
      setupMocks({ hasChanges: true, existingPRNumber: 42 });
      state.execImpl = async (cmd: string, args?: string[]): Promise<number> => {
        if (cmd === "git" && Array.isArray(args) && args.includes("push")) {
          throw new Error("rejected (non-fast-forward)");
        }
        return 0;
      };
      state.getExecOutputImpl = async (cmd: string, args?: string[]) => {
        if (cmd === "git" && Array.isArray(args) && args.includes("--porcelain")) {
          return { stdout: "M openapi/openapi.json\n", stderr: "", exitCode: 0 };
        }
        if (
          cmd === "git" &&
          Array.isArray(args) &&
          args.includes("pull") &&
          args.includes("--rebase")
        ) {
          return { stdout: "", stderr: "merge conflict", exitCode: 1 };
        }
        if (
          cmd === "git" &&
          Array.isArray(args) &&
          args.includes("rebase") &&
          args.includes("--abort")
        ) {
          return { stdout: "", stderr: "no rebase in progress", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };
      await importAndRun();

      const commentCall = mockIssuesCreateComment.mock.calls[0][0];
      expect(commentCall.body).toContain("Rebase error:");
      expect(commentCall.body).toContain("```");
      expect(commentCall.body).toContain("merge conflict");
      expect(commentCall.body).toContain("Rebase abort error:");
      expect(commentCall.body).toContain("no rebase in progress");
    });
  });

  describe("when auto_merge is true", () => {
    it("should not check for existing PRs or create new ones", async () => {
      setupMocks({ hasChanges: true, autoMerge: true });
      await importAndRun();

      expect(mockPullsList).not.toHaveBeenCalled();
      expect(mockPullsCreate).not.toHaveBeenCalled();

      expect(state.infoCalls).toEqual(
        expect.arrayContaining([expect.stringContaining("auto-merge is enabled")])
      );
    });
  });
});

describe("updateTargetSpec", () => {
  describe("repository format validation", () => {
    it("should fail with a clear message when repository has no slash", async () => {
      setupMocksForTargetSpec({ repository: "no-slash" });
      await importAndRun();

      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid repository format: "no-slash"')])
      );
      expect(mockReposGet).not.toHaveBeenCalled();
    });

    it("should fail with a clear message when repository has empty owner", async () => {
      setupMocksForTargetSpec({ repository: "/repo-only" });
      await importAndRun();

      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid repository format: "/repo-only"')])
      );
    });

    it("should fail with a clear message when repository has empty repo name", async () => {
      setupMocksForTargetSpec({ repository: "owner/" });
      await importAndRun();

      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([expect.stringContaining('Invalid repository format: "owner/"')])
      );
    });

    it("should fail with a clear message when repository has too many slashes", async () => {
      setupMocksForTargetSpec({ repository: "owner/repo/extra" });
      await importAndRun();

      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Invalid repository format: "owner/repo/extra"'),
        ])
      );
    });
  });

  describe("when changes are detected and no existing PR", () => {
    it("should clone the target repository and create a PR", async () => {
      setupMocksForTargetSpec({ hasChanges: true, existingPRNumber: null });
      await importAndRun();

      // Should have cloned the target repo
      const cloneCall = state.execCalls.find(
        ([cmd, args]) => cmd === "git" && Array.isArray(args) && args.includes("clone")
      );
      expect(cloneCall).toBeDefined();
      expect(cloneCall?.[1]).toEqual(
        expect.arrayContaining([expect.stringContaining("target-owner/target-repo.git")])
      );

      // Should create a PR in the target repo
      expect(mockPullsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "target-owner",
          repo: "target-repo",
          head: "update-api",
          base: "main",
        })
      );
    });

    it("should verify repository access before cloning", async () => {
      setupMocksForTargetSpec({ hasChanges: true });
      await importAndRun();

      expect(mockReposGet).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "target-owner", repo: "target-repo" })
      );
    });
  });

  describe("when no changes are detected", () => {
    it("should not push or create a PR", async () => {
      setupMocksForTargetSpec({ hasChanges: false });
      await importAndRun();

      expect(mockPullsCreate).not.toHaveBeenCalled();
      expect(state.infoCalls).toContain("No changes detected. Skipping further actions.");
    });
  });

  describe("when the target repo is inaccessible", () => {
    it("should fail with a repository access error", async () => {
      setupMocksForTargetSpec({ repository: "target-owner/target-repo" });
      mockReposGet.mockRejectedValue(new Error("Not Found"));
      await importAndRun();

      expect(state.setFailedCalls).toEqual(
        expect.arrayContaining([expect.stringContaining("Failed to verify repository access")])
      );
      // Should not attempt to clone
      const cloneCall = state.execCalls.find(
        ([cmd, args]) => cmd === "git" && Array.isArray(args) && args.includes("clone")
      );
      expect(cloneCall).toBeUndefined();
    });
  });

  describe("when an existing PR is found", () => {
    it("should update the existing PR instead of creating a new one", async () => {
      setupMocksForTargetSpec({ hasChanges: true, existingPRNumber: 99 });
      await importAndRun();

      expect(mockPullsCreate).not.toHaveBeenCalled();
      expect(mockPullsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "target-owner",
          repo: "target-repo",
          pull_number: 99,
        })
      );
    });
  });
});

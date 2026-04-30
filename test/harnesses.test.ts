import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCodexSession } from "../src/lib/eval/harnesses/codex.js";
import { codexHarness, piHarness, resolveHarness } from "../src/lib/eval/harnesses/index.js";
import type { EvalPlugin } from "../src/lib/eval/types.js";

const scoringPlugin: EvalPlugin = {
  name: "test",
  extensionPath: "/extension.ts",
  classifyFile(filePath) {
    return filePath.endsWith(".test.ts") ? "test" : "source";
  },
  scoreSession() {
    return { scores: {}, weights: {}, findings: [] };
  },
  buildJudgePrompt() {
    return "";
  },
};

describe("agent harnesses", () => {
  it("resolves Pi as the default harness", () => {
    expect(resolveHarness()).toBe(piHarness);
    expect(resolveHarness("pi")).toBe(piHarness);
  });

  it("builds the current Pi worker command", () => {
    const spec = piHarness.buildWorkerCommand({
      workDir: "/tmp/work",
      prompt: "Do the task",
      extensionPath: "/ext/index.ts",
      provider: "anthropic",
      model: "claude",
      thinking: "high",
    });

    expect(spec).toEqual({
      command: "pi",
      args: [
        "-p",
        "--mode",
        "json",
        "--no-extensions",
        "-e",
        "/ext/index.ts",
        "--no-session",
        "--provider",
        "anthropic",
        "--model",
        "claude",
        "--thinking",
        "high",
        "Do the task",
      ],
      env: {},
    });
  });

  it("builds a Codex worker command with the supported argv ordering", () => {
    const spec = codexHarness.buildWorkerCommand({
      workDir: "/tmp/work",
      prompt: "Do the task",
      extensionPath: "/unused.ts",
      model: "gpt-5.2",
      agent: {
        harness: "codex",
        codex: {
          ignoreUserConfig: true,
        },
      },
    });

    expect(spec.command).toBe("codex");
    expect(spec.args).toEqual([
      "--ask-for-approval",
      "never",
      "exec",
      "--json",
      "--cd",
      "/tmp/work",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "--ephemeral",
      "--model",
      "gpt-5.2",
      "--ignore-user-config",
      "Do the task",
    ]);
    expect(spec.env?.CODEX_HOME).toBeUndefined();
  });
});

describe("parseCodexSession", () => {
  it("extracts tool calls, results, usage, model info, and diff-based file writes", () => {
    const beforeFiles = new Map([["src/calc.ts", "3:100"]]);
    const afterFiles = new Map([
      ["src/calc.ts", "4:200"],
      ["src/calc.test.ts", "10:300"],
    ]);

    const session = parseCodexSession({
      rawLines: [
        JSON.stringify({
          type: "session.started",
          timestamp: "2026-01-01T00:00:00.000Z",
          model: "gpt",
          provider: "openai",
        }),
        JSON.stringify({
          type: "item.started",
          timestamp: "2026-01-01T00:00:01.000Z",
          item: {
            id: "call-1",
            type: "command_execution",
            command: "/bin/zsh -lc npm test",
            aggregated_output: "",
            exit_code: null,
            status: "in_progress",
          },
        }),
        JSON.stringify({
          type: "item.completed",
          timestamp: "2026-01-01T00:00:02.000Z",
          item: {
            id: "call-1",
            type: "command_execution",
            command: "/bin/zsh -lc npm test",
            aggregated_output: "ok",
            exit_code: 0,
            status: "completed",
          },
        }),
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 5, reasoning_output_tokens: 1 },
        }),
      ],
      stderr: "",
      plugin: scoringPlugin,
      exitCode: 0,
      status: "completed",
      startedAt: Date.parse("2026-01-01T00:00:00.000Z"),
      endedAt: Date.parse("2026-01-01T00:00:03.000Z"),
      beforeFiles,
      afterFiles,
    });

    expect(session.modelInfo).toEqual({ model: "gpt", provider: "openai" });
    expect(session.tokenUsage).toEqual({ input: 10, output: 5 });
    expect(session.toolCalls).toHaveLength(1);
    expect(session.toolCalls[0]).toMatchObject({
      name: "command_execution",
      arguments: { command: "/bin/zsh -lc npm test" },
      resultText: "ok",
    });
    expect(session.fileWrites).toEqual([
      { timestamp: 0, path: "src/calc.test.ts", tool: "write", labels: ["test"] },
      { timestamp: 0, path: "src/calc.ts", tool: "write", labels: ["source"] },
    ]);
  });

  it("rejects unauthenticated isolated Codex homes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-do-eval-codex-"));
    try {
      expect(() =>
        codexHarness.prepare?.({
          workDir: tmpDir,
          agent: { harness: "codex", codex: { home: path.join(tmpDir, ".codex-home") } },
        }),
      ).toThrow(/is not authenticated/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

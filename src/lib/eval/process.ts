import { spawn } from "node:child_process";
import type { SpawnSpec } from "./harnesses/types.js";
import { assertSandboxAvailable, buildSandboxedCommand } from "./sandbox.js";
import type { EvalRunStatus, SandboxOptions } from "./types.js";

export interface ProcessRunOptions {
  spawnSpec: SpawnSpec;
  workDir: string;
  timeoutMs: number;
  inactivityMs: number;
  sandbox?: boolean | SandboxOptions;
  onStdoutLine?: (line: string) => void;
  onActivity?: () => void;
}

export interface ProcessRunResult {
  status: EvalRunStatus;
  exitCode: number | null;
  stderr: string;
  stdoutLines: string[];
  startedAt: number;
  endedAt: number;
}

export async function runProcessWithTimeouts(opts: ProcessRunOptions): Promise<ProcessRunResult> {
  return new Promise<ProcessRunResult>((resolve) => {
    assertSandboxAvailable(opts.sandbox);
    let { command, args } = opts.spawnSpec;
    if (opts.sandbox) {
      const sandboxOpts = opts.sandbox === true ? undefined : opts.sandbox;
      ({ command, args } = buildSandboxedCommand(command, args, {
        workDir: opts.workDir,
        workDirAccess: "rw",
        options: sandboxOpts,
      }));
    }

    const startedAt = Date.now();
    const lines: string[] = [];
    let stderr = "";
    let lastActivity = startedAt;

    const proc = spawn(command, args, {
      cwd: opts.workDir,
      env: { ...process.env, ...opts.spawnSpec.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    function markActivity() {
      lastActivity = Date.now();
      opts.onActivity?.();
    }

    function finish(status: EvalRunStatus, code: number | null) {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      clearInterval(idleCheck);
      resolve({ status, exitCode: code, stderr, stdoutLines: lines, startedAt, endedAt: Date.now() });
    }

    let buffer = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      markActivity();
      buffer += chunk.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (!line.trim()) continue;
        lines.push(line);
        opts.onStdoutLine?.(line);
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      markActivity();
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (buffer.trim()) {
        lines.push(buffer);
        opts.onStdoutLine?.(buffer);
      }
      finish("completed", code);
    });

    proc.on("error", () => {
      finish("crashed", null);
    });

    const hardTimer = setTimeout(() => {
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5000);
      finish("timeout", null);
    }, opts.timeoutMs);

    const idleCheck = setInterval(() => {
      if (Date.now() - lastActivity > opts.inactivityMs) {
        proc.kill("SIGTERM");
        setTimeout(() => proc.kill("SIGKILL"), 5000);
        finish("stalled", null);
      }
    }, 10_000);
  });
}

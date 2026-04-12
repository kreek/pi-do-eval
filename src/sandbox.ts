import { execFileSync } from "node:child_process";
import type { SandboxOptions } from "./types.js";

let aiJailAvailable: boolean | null = null;

export function checkAiJail(): boolean {
  if (aiJailAvailable !== null) return aiJailAvailable;
  try {
    execFileSync("which", ["ai-jail"], { stdio: "ignore" });
    aiJailAvailable = true;
  } catch {
    console.warn("[pi-do-eval] ai-jail not found on PATH — running without sandbox");
    aiJailAvailable = false;
  }
  return aiJailAvailable;
}

export function _resetAiJailCache(): void {
  aiJailAvailable = null;
}

export interface SandboxSpawnConfig {
  workDir: string;
  workDirAccess: "rw" | "ro";
  options?: SandboxOptions;
}

export function buildSandboxedCommand(
  command: string,
  args: string[],
  config: SandboxSpawnConfig,
): { command: string; args: string[] } {
  if (!checkAiJail()) return { command, args };

  const jailArgs: string[] = [];

  if (config.workDirAccess === "rw") {
    jailArgs.push("--rw-map", `${config.workDir}:${config.workDir}`);
  } else {
    jailArgs.push("--map", `${config.workDir}:${config.workDir}`);
  }

  for (const p of config.options?.extraRwPaths ?? []) {
    jailArgs.push("--rw-map", `${p}:${p}`);
  }
  for (const p of config.options?.extraRoPaths ?? []) {
    jailArgs.push("--map", `${p}:${p}`);
  }

  if (config.options?.lockdown) {
    jailArgs.push("--lockdown");
  }

  return { command: "ai-jail", args: [...jailArgs, command, ...args] };
}

import type { EvalPlugin, EvalRunStatus, EvalSession } from "../types.js";

export interface SpawnSpec {
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
}

export interface AgentRuntimeConfig {
  harness?: string;
  provider?: string;
  model?: string;
  thinking?: string;
  env?: Record<string, string | undefined>;
  args?: string[];
  pi?: {
    extensionPath?: string;
    extraArgs?: string[];
    env?: Record<string, string | undefined>;
  };
  codex?: {
    home?: string;
    ignoreUserConfig?: boolean;
    pluginMarketplaces?: string[];
    profile?: string;
    extraArgs?: string[];
    env?: Record<string, string | undefined>;
  };
}

export interface HarnessPrepareContext {
  workDir: string;
  agent?: AgentRuntimeConfig;
}

export interface WorkerCommandContext {
  workDir: string;
  prompt: string;
  extensionPath: string;
  provider?: string;
  model?: string;
  thinking?: string;
  agent?: AgentRuntimeConfig;
}

export interface SessionIngestContext {
  rawLines: string[];
  stderr: string;
  plugin?: EvalPlugin;
  exitCode: number | null;
  status: EvalRunStatus;
  startedAt: number;
  endedAt: number;
  beforeFiles?: Map<string, string>;
  afterFiles?: Map<string, string>;
}

export interface HarnessCleanupContext {
  workDir: string;
  agent?: AgentRuntimeConfig;
}

export interface AgentHarness {
  id: string;
  requiresFileSnapshot?: boolean;
  prepare?(ctx: HarnessPrepareContext): void | Promise<void>;
  buildWorkerCommand(ctx: WorkerCommandContext): SpawnSpec;
  ingestWorkerSession(ctx: SessionIngestContext): EvalSession;
  cleanup?(ctx: HarnessCleanupContext): void | Promise<void>;
}

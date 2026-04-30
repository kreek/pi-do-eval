import { parseSessionLines } from "../parser.js";
import type { AgentHarness, WorkerCommandContext } from "./types.js";

export const piHarness: AgentHarness = {
  id: "pi",

  buildWorkerCommand(ctx: WorkerCommandContext) {
    const extensionPath = ctx.agent?.pi?.extensionPath ?? ctx.extensionPath;
    const provider = ctx.agent?.provider ?? ctx.provider;
    const model = ctx.agent?.model ?? ctx.model;
    const thinking = ctx.agent?.thinking ?? ctx.thinking;

    const args = ["-p", "--mode", "json", "--no-extensions", "-e", extensionPath, "--no-session"];
    if (provider) args.push("--provider", provider);
    if (model) args.push("--model", model);
    if (thinking) args.push("--thinking", thinking);
    args.push(...(ctx.agent?.args ?? []), ...(ctx.agent?.pi?.extraArgs ?? []), ctx.prompt);

    return {
      command: "pi",
      args,
      env: { ...ctx.agent?.env, ...ctx.agent?.pi?.env },
    };
  },

  ingestWorkerSession(ctx) {
    const session = parseSessionLines(ctx.rawLines, ctx.plugin);
    session.exitCode = ctx.exitCode;
    return session;
  },
};

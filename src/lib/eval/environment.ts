import { randomUUID } from "node:crypto";
import type { RunEnvironment } from "./types.js";

export function captureEnvironment(): RunEnvironment {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    runtime: `node/${process.version}`,
  };
}

export function generateRunId(): string {
  return randomUUID();
}

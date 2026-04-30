import { codexHarness } from "./codex.js";
import { piHarness } from "./pi.js";
import type { AgentHarness } from "./types.js";

const harnesses = new Map<string, AgentHarness>([
  [piHarness.id, piHarness],
  [codexHarness.id, codexHarness],
]);

export function registerHarness(harness: AgentHarness): () => void {
  if (harnesses.has(harness.id)) {
    throw new Error(`Agent harness "${harness.id}" is already registered`);
  }
  harnesses.set(harness.id, harness);
  return () => {
    if (harnesses.get(harness.id) === harness) harnesses.delete(harness.id);
  };
}

export function resolveHarness(id = "pi"): AgentHarness {
  const harness = harnesses.get(id);
  if (!harness) {
    const available = [...harnesses.keys()].sort().join(", ");
    throw new Error(`Unknown agent harness "${id}". Available harnesses: ${available}`);
  }
  return harness;
}

export type { AgentHarness, AgentRuntimeConfig, SpawnSpec } from "./types.js";
export { codexHarness, piHarness };

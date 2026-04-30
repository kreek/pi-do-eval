import { describe, expect, it } from "vitest";
import { captureEnvironment, generateRunId } from "../src/lib/eval/environment.js";

describe("captureEnvironment", () => {
  it("returns the current node version and platform", () => {
    const env = captureEnvironment();
    expect(env.nodeVersion).toBe(process.version);
    expect(env.platform).toBe(process.platform);
  });

  it("includes runtime identifier", () => {
    const env = captureEnvironment();
    expect(env.runtime).toMatch(/^node\/v\d/);
  });
});

describe("generateRunId", () => {
  it("returns a UUID-shaped string", () => {
    const id = generateRunId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns unique ids on consecutive calls", () => {
    const a = generateRunId();
    const b = generateRunId();
    expect(a).not.toBe(b);
  });
});

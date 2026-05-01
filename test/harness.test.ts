import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getRunCommandForEvalDir, loadLauncherConfigFromEvalDir } from "../src/lib/server/harness.js";

let tmpDir: string | null = null;

function makeEvalDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-do-eval-harness-"));
  const evalDir = path.join(tmpDir, "eval");
  fs.mkdirSync(path.join(evalDir, "trials", "example"), { recursive: true });
  fs.writeFileSync(
    path.join(evalDir, "trials", "example", "config.ts"),
    "export default { description: 'Example trial', variants: { default: {}, edge: {} } };\n",
  );
  fs.writeFileSync(path.join(evalDir, "eval.ts"), "export {};\n");
  fs.writeFileSync(path.join(evalDir, "package.json"), JSON.stringify({ type: "module" }));
  return evalDir;
}

afterEach(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});

describe("getRunCommandForEvalDir", () => {
  it("uses the eval package script when one is defined", () => {
    const evalDir = makeEvalDir();
    fs.writeFileSync(
      path.join(evalDir, "package.json"),
      JSON.stringify({ type: "module", scripts: { eval: "tsx eval.ts" } }),
    );

    expect(getRunCommandForEvalDir(evalDir)).toBe("npm run eval --");
  });

  it("keeps the legacy scaffold command when no package eval script exists", () => {
    const evalDir = makeEvalDir();

    expect(getRunCommandForEvalDir(evalDir)).toBe("bun eval.ts");
  });
});

describe("loadLauncherConfigFromEvalDir", () => {
  it("loads suites using the normalized trial and variant contract", async () => {
    const evalDir = makeEvalDir();
    fs.writeFileSync(
      path.join(evalDir, "eval.config.ts"),
      "export default { suites: { quick: [{ trial: 'example', variant: 'default' }] } };\n",
    );

    const config = await loadLauncherConfigFromEvalDir(evalDir);

    expect(config?.trials).toEqual([
      { name: "example", description: "Example trial", variants: ["default", "edge"], enabled: true },
    ]);
    expect(config?.suites).toEqual({ quick: [{ trial: "example", variant: "default" }] });
    expect(config?.suiteDefs).toEqual([
      { name: "quick", trials: [{ trial: "example", variant: "default" }], source: "config" },
    ]);
  });

  it("fails clearly when configured suites omit variants", async () => {
    const evalDir = makeEvalDir();
    fs.writeFileSync(
      path.join(evalDir, "eval.config.ts"),
      "export default { suites: { quick: [{ trial: 'example' }] } };\n",
    );

    await expect(loadLauncherConfigFromEvalDir(evalDir)).rejects.toThrow(
      /Eval launcher contract violation: suite "quick" entry 0\.variant/,
    );
  });

  it("fails clearly when suites reference unknown trial variants", async () => {
    const evalDir = makeEvalDir();
    fs.writeFileSync(
      path.join(evalDir, "eval.config.ts"),
      "export default { suites: { quick: [{ trial: 'example', variant: 'missing' }] } };\n",
    );

    await expect(loadLauncherConfigFromEvalDir(evalDir)).rejects.toThrow(
      /suite "quick" references unknown variant "missing" for trial "example"/,
    );
  });

  it("propagates the project's defaultLaunchType so the launcher card can preselect the right tab", async () => {
    const evalDir = makeEvalDir();
    fs.writeFileSync(
      path.join(evalDir, "eval.config.ts"),
      "export default { suites: { quick: [{ trial: 'example', variant: 'default' }] }, defaultLaunchType: 'bench' };\n",
    );

    const config = await loadLauncherConfigFromEvalDir(evalDir);

    expect(config?.defaultLaunchType).toBe("bench");
  });

  it("omits defaultLaunchType when the project does not specify one", async () => {
    const evalDir = makeEvalDir();
    fs.writeFileSync(
      path.join(evalDir, "eval.config.ts"),
      "export default { suites: { quick: [{ trial: 'example', variant: 'default' }] } };\n",
    );

    const config = await loadLauncherConfigFromEvalDir(evalDir);

    expect(config?.defaultLaunchType).toBeUndefined();
  });
});

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInit } from "../cli/init.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-do-eval-init-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writePkg(pkg: Record<string, unknown>) {
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));
}

describe("runInit", () => {
  it("scaffolds the eval directory from a Pi extension repo", async () => {
    writePkg({
      name: "my-ext",
      pi: { extensions: ["./src/index.ts"] },
    });

    // Suppress process.exit
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await runInit(tmpDir);

    const evalDir = path.join(tmpDir, "eval");
    expect(fs.existsSync(path.join(evalDir, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "tsconfig.json"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, ".gitignore"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "types.ts"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "eval.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "eval.ts"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "plugins", "my-ext.ts"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "trials", "example", "config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(evalDir, "trials", "example", "task.md"))).toBe(true);

    // Check package.json contents
    const pkg = JSON.parse(fs.readFileSync(path.join(evalDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("my-ext-eval");
    expect(pkg.dependencies["pi-do-eval"]).toBeDefined();

    // Check plugin references the correct extension path
    const pluginContent = fs.readFileSync(path.join(evalDir, "plugins", "my-ext.ts"), "utf-8");
    expect(pluginContent).toContain('"my-ext"');
    expect(pluginContent).toContain('path.resolve(import.meta.dirname, "..", "../src/index.ts")');

    // Check trial config references the plugin
    const trialConfig = fs.readFileSync(path.join(evalDir, "trials", "example", "config.ts"), "utf-8");
    expect(trialConfig).toContain('"my-ext"');

    mockExit.mockRestore();
  });

  it("scaffolds profile and layer benchmark experiments", async () => {
    writePkg({
      name: "my-ext",
      pi: { extensions: ["./src/index.ts"] },
    });

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await runInit(tmpDir);

    const evalDir = path.join(tmpDir, "eval");
    const typesContent = fs.readFileSync(path.join(evalDir, "types.ts"), "utf-8");
    expect(typesContent).toContain('import type { AgentRuntimeConfig, ExecutionProfile } from "pi-do-eval";');
    expect(typesContent).toContain("export interface ExperimentConfig");
    expect(typesContent).toContain("profiles?: Record<string, ExecutionProfile>;");
    expect(typesContent).toContain("experiments?: Record<string, ExperimentConfig>;");

    const configContent = fs.readFileSync(path.join(evalDir, "eval.config.ts"), "utf-8");
    expect(configContent).toContain("codexBaseline");
    expect(configContent).toContain("codexWithSkills");
    expect(configContent).toContain("codexWithPlugin");
    expect(configContent).not.toContain("codexControl");
    expect(configContent).not.toContain("codexAbp");
    expect(configContent).toContain("isolateHome: true");
    expect(configContent).toContain('kind: "skill-library"');
    expect(configContent).toContain('kind: "plugin"');
    expect(configContent).toContain('mode: "install"');

    const evalContent = fs.readFileSync(path.join(evalDir, "eval.ts"), "utf-8");
    expect(evalContent).toContain("createProfileBenchReport");
    expect(evalContent).toContain("function prepareProfileWorkDir");
    expect(evalContent).toContain("function profileRuntimeAgent");
    expect(evalContent).toContain('return path.join(".codex", "skills");');
    expect(evalContent).toContain("prepareWorkDir: opts.profile");
    expect(evalContent).toContain('} else if (command === "experiment")');
    expect(evalContent).toContain("eval experiment <name>");
    expect(evalContent).toContain("must set baseline when comparing multiple profiles");

    mockExit.mockRestore();
  });

  it("aborts if no package.json exists", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(runInit(tmpDir)).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it("aborts if eval/ directory already exists with files", async () => {
    writePkg({ name: "my-ext" });
    const evalDir = path.join(tmpDir, "eval");
    fs.mkdirSync(evalDir);
    fs.writeFileSync(path.join(evalDir, "existing.ts"), "// existing");

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(runInit(tmpDir)).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it("falls back gracefully when pi.extensions is missing", async () => {
    writePkg({ name: "plain-pkg" });

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await runInit(tmpDir);

    const evalDir = path.join(tmpDir, "eval");
    expect(fs.existsSync(path.join(evalDir, "plugins", "plain-pkg.ts"))).toBe(true);

    // Plugin should use fallback extension path
    const pluginContent = fs.readFileSync(path.join(evalDir, "plugins", "plain-pkg.ts"), "utf-8");
    expect(pluginContent).toContain('path.resolve(import.meta.dirname, "..", "../../src/index.ts")');

    mockExit.mockRestore();
  });
});

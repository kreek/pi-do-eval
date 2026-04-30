import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteFileSuite,
  loadFileSuites,
  mergeSuiteSources,
  type SuiteDefinition,
  writeFileSuite,
} from "../src/lib/eval/suite-files.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-do-eval-suites-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, data: unknown): void {
  const dir = path.join(tmpDir, "suites");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
}

describe("loadFileSuites", () => {
  it("returns empty array when suites/ directory does not exist", () => {
    expect(loadFileSuites(tmpDir)).toEqual([]);
  });

  it("loads and parses all JSON files under suites/", () => {
    writeFixture("smoke", {
      name: "smoke",
      description: "Quick smoke test",
      trials: [{ trial: "trial-a", variant: "default" }],
      regressionThreshold: 3,
    });
    writeFixture("full", {
      name: "full",
      trials: [
        { trial: "trial-a", variant: "default" },
        { trial: "trial-b", variant: "default" },
      ],
    });

    const suites = loadFileSuites(tmpDir);

    expect(suites).toHaveLength(2);
    expect(suites.map((suite) => suite.name).sort()).toEqual(["full", "smoke"]);
    const smoke = suites.find((suite) => suite.name === "smoke");
    expect(smoke?.trials).toHaveLength(1);
    expect(smoke?.regressionThreshold).toBe(3);
  });

  it("derives missing name from filename", () => {
    writeFixture("unnamed", {
      trials: [{ trial: "trial-a", variant: "default" }],
    });

    const suites = loadFileSuites(tmpDir);
    expect(suites).toHaveLength(1);
    expect(suites[0]?.name).toBe("unnamed");
  });

  it("skips invalid JSON files", () => {
    const dir = path.join(tmpDir, "suites");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "broken.json"), "not json");
    writeFixture("ok", { name: "ok", trials: [] });

    const suites = loadFileSuites(tmpDir);
    expect(suites.map((suite) => suite.name)).toEqual(["ok"]);
  });
});

describe("mergeSuiteSources", () => {
  it("combines config-defined and file-defined suites", () => {
    const configSuites = {
      "from-config": [{ trial: "trial-a", variant: "default" }],
    };
    const fileSuites: SuiteDefinition[] = [{ name: "from-file", trials: [{ trial: "trial-b", variant: "default" }] }];

    const merged = mergeSuiteSources(configSuites, fileSuites);
    expect(Object.keys(merged).sort()).toEqual(["from-config", "from-file"]);
    expect(merged["from-file"]).toEqual([{ trial: "trial-b", variant: "default" }]);
  });

  it("lets file suites override config suites of the same name", () => {
    const configSuites = {
      smoke: [{ trial: "old", variant: "default" }],
    };
    const fileSuites: SuiteDefinition[] = [{ name: "smoke", trials: [{ trial: "new", variant: "default" }] }];

    const merged = mergeSuiteSources(configSuites, fileSuites);
    expect(merged.smoke).toEqual([{ trial: "new", variant: "default" }]);
  });
});

describe("writeFileSuite + deleteFileSuite", () => {
  it("writes a suite JSON file that loadFileSuites round-trips", () => {
    const suite: SuiteDefinition = {
      name: "regression",
      description: "Everything",
      trials: [{ trial: "trial-a", variant: "default" }],
      regressionThreshold: 5,
    };
    writeFileSuite(tmpDir, suite);

    const loaded = loadFileSuites(tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(suite);
  });

  it("removes the suite JSON file", () => {
    writeFileSuite(tmpDir, {
      name: "temp",
      trials: [{ trial: "trial-a", variant: "default" }],
    });
    expect(loadFileSuites(tmpDir)).toHaveLength(1);

    deleteFileSuite(tmpDir, "temp");
    expect(loadFileSuites(tmpDir)).toHaveLength(0);
  });

  it("rejects invalid suite names to avoid path traversal", () => {
    expect(() => writeFileSuite(tmpDir, { name: "../evil", trials: [] })).toThrow();
    expect(() => deleteFileSuite(tmpDir, "../evil")).toThrow();
  });
});

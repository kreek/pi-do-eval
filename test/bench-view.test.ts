import { describe, expect, it } from "vitest";
import {
  benchAverageDelta,
  benchComparisonIds,
  benchEntryDelta,
  benchFirstAverageDelta,
  benchLayerSummary,
  benchProfileCountLabel,
  benchProfileIds,
  benchProfileLabel,
} from "../src/lib/bench-view.js";
import type { BenchReport } from "../src/lib/eval/types.js";

const report: BenchReport = {
  suite: "engineering-maturity",
  benchRunId: "bench-1",
  startedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-01-01T00:20:00Z",
  baselineProfileId: "codexBaseline",
  profiles: [
    {
      id: "codexWithLayer",
      label: "Codex + Layer",
      factors: {
        harness: "codex",
        model: "gpt-5.4",
        layers: [{ id: "engineering-layer", kind: "skill-library", runtime: "codex" }],
      },
    },
    {
      id: "codexBaseline",
      label: "Codex baseline",
      factors: {
        harness: "codex",
        model: "gpt-5.4",
        layers: [],
      },
    },
  ],
  models: ["codexWithLayer", "codexBaseline"],
  suiteRunIds: {
    codexBaseline: "suite-baseline",
    codexWithLayer: "suite-layer",
  },
  entries: [
    {
      trial: "bugfix",
      variant: "default",
      overall: { codexBaseline: 70, codexWithLayer: 84 },
      deterministic: {},
      deltas: { codexWithLayer: 14 },
    },
  ],
  averages: { codexBaseline: 70, codexWithLayer: 84 },
  averageDeltas: { codexWithLayer: 14 },
};

describe("bench view helpers", () => {
  it("orders the baseline first and exposes layer labels", () => {
    expect(benchProfileIds(report)).toEqual(["codexBaseline", "codexWithLayer"]);
    expect(benchComparisonIds(report)).toEqual(["codexWithLayer"]);
    expect(benchProfileLabel(report, "codexWithLayer")).toBe("Codex + Layer");
    expect(benchLayerSummary(report, "codexBaseline")).toBe("No layers");
    expect(benchLayerSummary(report, "codexWithLayer")).toBe("engineering-layer");
    expect(benchProfileCountLabel(report)).toBe("2 profiles");
  });

  it("uses baseline deltas as treatment minus baseline", () => {
    expect(benchAverageDelta(report, "codexBaseline")).toBeNull();
    expect(benchAverageDelta(report, "codexWithLayer")).toBe(14);
    expect(benchFirstAverageDelta(report)).toBe(14);
    expect(
      benchEntryDelta(report, report.entries[0] as NonNullable<(typeof report.entries)[0]>, "codexWithLayer"),
    ).toBe(14);
  });

  it("keeps the legacy first-minus-last fallback for two model reports without a baseline", () => {
    const modelReport: BenchReport = {
      ...report,
      baselineProfileId: undefined,
      profiles: undefined,
      models: ["model-a", "model-b"],
      averages: { "model-a": 82, "model-b": 74 },
      averageDeltas: undefined,
      entries: [
        {
          trial: "bugfix",
          variant: "default",
          overall: { "model-a": 82, "model-b": 74 },
          deterministic: {},
        },
      ],
    };

    expect(benchComparisonIds(modelReport)).toEqual(["model-a"]);
    expect(benchAverageDelta(modelReport, "model-a")).toBe(8);
    expect(
      benchEntryDelta(modelReport, modelReport.entries[0] as NonNullable<(typeof modelReport.entries)[0]>, "model-a"),
    ).toBe(8);
  });
});

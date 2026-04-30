import { describe, expect, it } from "vitest";
import {
  benchIndexCodec,
  partialTrialMetaCodec,
  projectRegistryCodec,
  runRequestCodec,
  suiteDefinitionCodec,
  trialMetaCodec,
} from "../src/lib/contracts/domain.js";

describe("contract codecs", () => {
  it("parses valid run request variants and rejects illegal combinations", () => {
    expect(runRequestCodec.parse({ type: "trial", trial: "a", variant: "default" })).toEqual({
      ok: true,
      value: { type: "trial", trial: "a", variant: "default" },
      issues: [],
    });
    expect(runRequestCodec.parse({ type: "suite", suite: "smoke", noJudge: true }).ok).toBe(true);
    expect(runRequestCodec.parse({ type: "trial", trial: "a" }).ok).toBe(false);
    expect(runRequestCodec.parse({ type: "bench" }).ok).toBe(false);
  });

  it("preserves optional benchmark profile metadata in bench indexes", () => {
    const parsed = benchIndexCodec.parse([
      {
        suite: "smoke",
        benchRunId: "bench-1",
        dir: "bench-1-smoke",
        completedAt: "2026-01-01T00:00:00Z",
        profiles: [
          {
            id: "baseline",
            label: "Baseline",
            factors: { harness: "codex", model: "gpt-5.4", layers: [] },
          },
          {
            id: "layered",
            label: "Layered",
            factors: {
              harness: "codex",
              model: "gpt-5.4",
              layers: [{ id: "quality-layer", kind: "skill-library", runtime: "codex" }],
            },
          },
        ],
        baselineProfileId: "baseline",
        models: ["baseline", "layered"],
        averages: { baseline: 70, layered: 84 },
        averageDeltas: { layered: 14 },
      },
    ]);

    expect(parsed.ok).toBe(true);
    expect(parsed.value[0]?.profiles?.[1]?.factors.layers[0]?.id).toBe("quality-layer");
    expect(parsed.value[0]?.baselineProfileId).toBe("baseline");
    expect(parsed.value[0]?.averageDeltas).toEqual({ layered: 14 });
  });

  it("normalizes project registries and drops invalid entries", () => {
    const parsed = projectRegistryCodec.parse({
      activeProjectId: "missing",
      projects: [
        {
          id: "p1",
          name: "One",
          projectRoot: "/repo",
          evalDir: "/repo/eval",
          addedAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          lastSelectedAt: "2026-01-02T00:00:00Z",
        },
        { id: "broken" },
      ],
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.value.projects).toHaveLength(1);
    expect(parsed.value.activeProjectId).toBe("p1");
  });

  it("validates suite definition trial refs", () => {
    expect(
      suiteDefinitionCodec.parse({
        name: "smoke",
        trials: [{ trial: "example", variant: "default" }],
      }).ok,
    ).toBe(true);
    expect(suiteDefinitionCodec.parse({ name: "smoke", trials: [{ trial: "example" }] }).ok).toBe(false);
  });

  it("keeps tolerant trial meta loading separate from strict route meta parsing", () => {
    expect(trialMetaCodec.parse({ tags: ["ok", 1], enabled: "yes" }).value).toEqual({ tags: ["ok"] });
    expect(partialTrialMetaCodec.parse({ tags: ["ok", 1] }).ok).toBe(false);
  });
});

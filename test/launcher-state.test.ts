import { describe, expect, it } from "vitest";
import { normalizeLauncherSelection } from "../src/lib/components/launcher-state.js";
import type { LauncherConfig } from "../src/lib/eval/types.js";

const config: LauncherConfig = {
  trials: [
    { name: "alpha", description: "Alpha", variants: ["v1", "v2"] },
    { name: "beta", description: "Beta", variants: ["v3"] },
  ],
  suites: {
    micro: [{ trial: "alpha", variant: "v1" }],
    small: [{ trial: "beta", variant: "v3" }],
  },
  models: [],
};

describe("normalizeLauncherSelection", () => {
  it("keeps valid selections", () => {
    expect(
      normalizeLauncherSelection(config, {
        selectedSuite: "small",
        selectedTrial: "alpha",
        selectedVariant: "v2",
      }),
    ).toEqual({
      selectedSuite: "small",
      selectedTrial: "alpha",
      selectedVariant: "v2",
    });
  });

  it("falls back to the first valid suite, trial, and variant", () => {
    expect(
      normalizeLauncherSelection(config, {
        selectedSuite: "full",
        selectedTrial: "missing",
        selectedVariant: "missing",
      }),
    ).toEqual({
      selectedSuite: "micro",
      selectedTrial: "alpha",
      selectedVariant: "v1",
    });
  });

  it("repairs a stale variant when the trial stays valid", () => {
    expect(
      normalizeLauncherSelection(config, {
        selectedSuite: "micro",
        selectedTrial: "beta",
        selectedVariant: "v2",
      }),
    ).toEqual({
      selectedSuite: "micro",
      selectedTrial: "beta",
      selectedVariant: "v3",
    });
  });
});

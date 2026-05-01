import type { BenchEntry, BenchIndexEntry, BenchReport, ExecutionProfileSnapshot } from "$eval/types.js";

type BenchLike = Pick<BenchReport | BenchIndexEntry, "profiles" | "baselineProfileId" | "models" | "averages"> & {
  averageDeltas?: Record<string, number>;
};

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function profileMap(report: Pick<BenchLike, "profiles">): Map<string, ExecutionProfileSnapshot> {
  return new Map(report.profiles?.map((profile) => [profile.id, profile]) ?? []);
}

export function benchProfileIds(report: Pick<BenchLike, "profiles" | "baselineProfileId" | "models">): string[] {
  const ids = [...new Set([...(report.profiles?.map((profile) => profile.id) ?? []), ...report.models])];
  if (!report.baselineProfileId || !ids.includes(report.baselineProfileId)) return ids;
  return [report.baselineProfileId, ...ids.filter((id) => id !== report.baselineProfileId)];
}

export function benchComparisonIds(report: Pick<BenchLike, "profiles" | "baselineProfileId" | "models">): string[] {
  const ids = benchProfileIds(report);
  if (report.baselineProfileId) return ids.filter((id) => id !== report.baselineProfileId);
  return ids.length === 2 ? [ids[0] as string] : [];
}

export function benchProfileLabel(report: Pick<BenchLike, "profiles">, profileId: string): string {
  return profileMap(report).get(profileId)?.label ?? profileId;
}

export function benchShortProfileLabel(report: Pick<BenchLike, "profiles">, profileId: string): string {
  const label = benchProfileLabel(report, profileId);
  const parts = label.split("/");
  return parts[parts.length - 1]?.trim() || label;
}

export function benchLayerSummary(report: Pick<BenchLike, "profiles">, profileId: string): string {
  const layers = profileMap(report).get(profileId)?.factors.layers ?? [];
  if (layers.length === 0) return "No layers";
  return layers.map((layer) => layer.id).join(", ");
}

export function benchProfileCount(report: Pick<BenchLike, "profiles" | "models">): number {
  return report.profiles?.length ?? report.models.length;
}

export function benchProfileCountLabel(report: Pick<BenchLike, "profiles" | "models">): string {
  const count = benchProfileCount(report);
  const noun = report.profiles ? "profile" : "model";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function benchDeltaLabel(report: Pick<BenchLike, "profiles" | "baselineProfileId">, _profileId: string): string {
  if (!report.baselineProfileId) return "Delta";
  return `Delta vs ${benchShortProfileLabel(report, report.baselineProfileId)}`;
}

export function benchAverageDelta(report: BenchLike, profileId: string): number | null {
  if (report.baselineProfileId) {
    if (profileId === report.baselineProfileId) return null;
    const explicit = report.averageDeltas?.[profileId];
    if (explicit !== undefined) return explicit;
    const baseline = report.averages[report.baselineProfileId];
    const compared = report.averages[profileId];
    return baseline !== undefined && compared !== undefined ? roundToTenth(compared - baseline) : null;
  }

  const ids = benchProfileIds(report);
  if (ids.length !== 2 || profileId !== ids[0]) return null;
  const first = report.averages[ids[0] as string];
  const last = report.averages[ids[1] as string];
  return first !== undefined && last !== undefined ? roundToTenth(first - last) : null;
}

export function benchEntryDelta(
  report: Pick<BenchReport, "profiles" | "baselineProfileId" | "models">,
  entry: BenchEntry,
  profileId: string,
): number | null {
  if (report.baselineProfileId) {
    const explicit = entry.deltas?.[profileId];
    if (explicit !== undefined) return explicit;
    const baseline = entry.overall[report.baselineProfileId];
    const compared = entry.overall[profileId];
    return baseline !== undefined && compared !== undefined ? roundToTenth(compared - baseline) : null;
  }

  const ids = benchProfileIds(report);
  if (ids.length !== 2 || profileId !== ids[0]) return null;
  const first = entry.overall[ids[0] as string];
  const last = entry.overall[ids[1] as string];
  return first !== undefined && last !== undefined ? roundToTenth(first - last) : null;
}

export function benchFirstAverageDelta(report: BenchLike): number | null {
  const profileId = benchComparisonIds(report)[0];
  return profileId ? benchAverageDelta(report, profileId) : null;
}

// The "treatment" profile's average — i.e. the non-baseline side of the
// comparison. Used as the bench row's score badge so the sidebar's
// rightmost column has the same shape across bench / suite / run rows.
export function benchComparisonAverage(report: BenchLike): number | null {
  const profileId = benchComparisonIds(report)[0];
  if (!profileId) return null;
  const value = report.averages[profileId];
  return value !== undefined ? roundToTenth(value) : null;
}

import { writable } from "svelte/store";
import type { RunIndexEntry, RunRequest } from "$eval/types.js";

export const selectedSuiteName = writable<string | null>(null);
export const selectedSuiteRunId = writable<string | null>(null);
export const selectedRunDir = writable<string | null>(null);
export const selectedBenchId = writable<string | null>(null);

export interface PendingLaunch {
  id: string;
  type: RunRequest["type"];
  suite?: string;
  trial?: string;
  variant?: string;
  modelLabel?: string;
  startedAt: string;
}

export const pendingLaunch = writable<PendingLaunch | null>(null);

// Sidebar expansion state
export const expandedSuites = writable<Set<string>>(new Set());
export const expandedRuns = writable<Set<string>>(new Set());
// Tracked separately from `expandedSuites` so a suite can be open in
// the regression view while collapsed in the bench view, and vice
// versa — the two views answer different questions.
export const expandedBenchSuites = writable<Set<string>>(new Set());
// Keyed by `${suite}::${workerModel}` since regression groups are per
// (suite, profile) pair — not per suite — so two profiles' timelines
// don't collapse together.
export const expandedRegressionGroups = writable<Set<string>>(new Set());

// Which top-of-sidebar tab is showing — bench (cross-profile comparison)
// or regression (single-profile drift over time).
export type SidebarView = "bench" | "regression";
export const sidebarView = writable<SidebarView>("bench");

export function selectSuiteName(name: string): void {
  pendingLaunch.set(null);
  selectedSuiteName.set(name);
  selectedSuiteRunId.set(null);
  selectedRunDir.set(null);
  selectedBenchId.set(null);
  sidebarView.set("regression");
}

export function selectSuiteRun(suiteName: string, suiteRunId: string): void {
  pendingLaunch.set(null);
  selectedSuiteName.set(suiteName);
  selectedSuiteRunId.set(suiteRunId);
  selectedRunDir.set(null);
  selectedBenchId.set(null);
  sidebarView.set("regression");

  // Auto-expand
  expandedSuites.update((s) => {
    s.add(suiteName);
    return s;
  });
}

export function selectRun(dir: string): void {
  pendingLaunch.set(null);
  selectedSuiteName.set(null);
  selectedSuiteRunId.set(null);
  selectedRunDir.set(dir);
  selectedBenchId.set(null);
  sidebarView.set("regression");
}

export function selectBench(benchId: string, suiteName?: string): void {
  pendingLaunch.set(null);
  selectedSuiteName.set(null);
  selectedSuiteRunId.set(null);
  selectedRunDir.set(null);
  selectedBenchId.set(benchId);
  sidebarView.set("bench");
  if (suiteName) {
    expandedBenchSuites.update((s) => {
      s.add(suiteName);
      return s;
    });
  }
}

export function setSidebarView(view: SidebarView): void {
  sidebarView.set(view);
}

export function selectPendingLaunch(launch: PendingLaunch): void {
  selectedSuiteName.set(null);
  selectedSuiteRunId.set(null);
  selectedRunDir.set(null);
  selectedBenchId.set(null);
  pendingLaunch.set(launch);
}

export function clearPendingLaunch(): void {
  pendingLaunch.set(null);
}

export function resetSelection(): void {
  selectedSuiteName.set(null);
  selectedSuiteRunId.set(null);
  selectedRunDir.set(null);
  selectedBenchId.set(null);
  pendingLaunch.set(null);
  expandedSuites.set(new Set());
  expandedRuns.set(new Set());
  expandedBenchSuites.set(new Set());
  expandedRegressionGroups.set(new Set());
  sidebarView.set("bench");
}

export function toggleSuite(name: string): void {
  expandedSuites.update((s) => {
    if (s.has(name)) s.delete(name);
    else s.add(name);
    return s;
  });
}

export function toggleBenchSuite(name: string): void {
  expandedBenchSuites.update((s) => {
    if (s.has(name)) s.delete(name);
    else s.add(name);
    return s;
  });
}

export function toggleRegressionGroup(groupKey: string): void {
  expandedRegressionGroups.update((s) => {
    if (s.has(groupKey)) s.delete(groupKey);
    else s.add(groupKey);
    return s;
  });
}

export function expandRegressionGroup(groupKey: string): void {
  expandedRegressionGroups.update((s) => {
    s.add(groupKey);
    return s;
  });
}

export function toggleSuiteRun(id: string): void {
  expandedRuns.update((s) => {
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  });
}

export function focusRun(run: RunIndexEntry): void {
  if (run.suite) {
    expandedSuites.update((s) => {
      s.add(run.suite as string);
      return s;
    });
  }
  if (run.suiteRunId) {
    expandedRuns.update((s) => {
      s.add(run.suiteRunId as string);
      return s;
    });
  }
  selectRun(run.dir);
}

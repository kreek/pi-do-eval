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
export const expandedRuns = writable<Set<string>>(new Set());
// Bench view is keyed on suite name (one bench group per suite).
export const expandedBenchSuites = writable<Set<string>>(new Set());
// Regression view is keyed on `${suite}::${workerModel}` — each
// (suite, profile) pair is its own timeline, so two profiles on the
// same suite collapse independently.
export const expandedRegressionGroups = writable<Set<string>>(new Set());

// Which top-of-sidebar tab is showing — bench (cross-profile comparison)
// or regression (single-profile drift over time).
export type SidebarView = "bench" | "regression";
export const sidebarView = writable<SidebarView>("bench");

export function selectSuiteRun(suiteName: string, suiteRunId: string, workerModel?: string): void {
  pendingLaunch.set(null);
  selectedSuiteName.set(suiteName);
  selectedSuiteRunId.set(suiteRunId);
  selectedRunDir.set(null);
  selectedBenchId.set(null);
  sidebarView.set("regression");

  // Auto-expand the matching regression group so the just-selected run is
  // visible in the sidebar's collapsed tree. The group is keyed by the
  // composite (suite, profile) — callers that know the workerModel pass it
  // explicitly; older callers without it fall back to no auto-expand.
  if (workerModel) {
    expandedRegressionGroups.update((s) => {
      s.add(`${suiteName}::${workerModel}`);
      return s;
    });
  }
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
  expandedRuns.set(new Set());
  expandedBenchSuites.set(new Set());
  expandedRegressionGroups.set(new Set());
  sidebarView.set("bench");
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
    expandedRegressionGroups.update((s) => {
      s.add(`${run.suite}::${run.workerModel}`);
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

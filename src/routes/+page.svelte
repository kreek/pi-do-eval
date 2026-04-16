<script lang="ts">
	import {
		selectedSuiteName,
		selectedSuiteRunId,
		selectedRunDir,
		selectedBenchId,
	} from "../stores/selection.js";
	import {
		runs,
		benchIndex,
		currentSuiteReport,
		currentRunReport,
		currentBenchReport,
		reportLoading,
		reportError,
		loadSuiteReport,
		loadRunReport,
		loadBenchReport,
		sidebarItems,
	} from "../stores/runs.js";
	import SuiteOverview from "$lib/components/SuiteOverview.svelte";
	import SuiteRunDetail from "$lib/components/SuiteRunDetail.svelte";
	import RunDetail from "$lib/components/RunDetail.svelte";
	import BenchDetail from "$lib/components/BenchDetail.svelte";
	import ConfigView from "$lib/components/ConfigView.svelte";
	import PendingSelectionView from "$lib/components/PendingSelectionView.svelte";
	import { launcherConfig } from "../stores/launcher.js";
	import { pendingLaunch } from "../stores/selection.js";
	import { activeProject, projects, projectsLoading } from "../stores/projects.js";

	// React to selection changes
	$effect(() => {
		const suiteRunId = $selectedSuiteRunId;
		const suiteName = $selectedSuiteName;
		if (suiteRunId && suiteName) {
			loadSuiteReport(suiteName, suiteRunId);
		}
	});

	$effect(() => {
		const dir = $selectedRunDir;
		if (dir) {
			loadRunReport(dir);
		}
	});

	$effect(() => {
		const benchId = $selectedBenchId;
		if (benchId) {
			loadBenchReport(benchId);
		}
	});

	let selectedRunEntry = $derived($runs.find((run) => run.dir === $selectedRunDir) ?? null);

	let selectedSuiteRunEntry = $derived.by(() => {
		const suiteName = $selectedSuiteName;
		const suiteRunId = $selectedSuiteRunId;
		if (!suiteName || !suiteRunId) return null;
		return (
			$sidebarItems.find((suite) => suite.suite === suiteName)?.suiteRuns.find(
				(run) => run.suiteRunId === suiteRunId,
			) ?? null
		);
	});

	let pendingView = $derived.by(() => {
		if ($pendingLaunch) {
			const target =
				$pendingLaunch.type === "trial"
					? `${$pendingLaunch.trial}/${$pendingLaunch.variant}`
					: $pendingLaunch.type === "suite"
						? `Suite: ${$pendingLaunch.suite}`
						: `Bench: ${$pendingLaunch.suite}`;
			return {
				eyebrow: "Launching",
				title: target,
				description: $pendingLaunch.modelLabel
					? `Starting with ${$pendingLaunch.modelLabel}. The run view will attach as soon as the first files appear.`
					: "Starting run. The run view will attach as soon as the first files appear.",
				status: "Waiting for first run data",
			};
		}

		if (selectedRunEntry?.status === "running") {
			return {
				eyebrow: "Live Run",
				title: `${selectedRunEntry.trial}/${selectedRunEntry.variant}`,
				description: selectedRunEntry.workerModel
					? `Running with ${selectedRunEntry.workerModel}`
					: "Run is currently in progress.",
				status: "Collecting live data",
				durationMs: selectedRunEntry.durationMs,
			};
		}

		if (selectedSuiteRunEntry?.status === "running" && $selectedSuiteName) {
			return {
				eyebrow: "Live Suite",
				title: `Suite: ${$selectedSuiteName}`,
				description: selectedSuiteRunEntry.workerModel
					? `Running with ${selectedSuiteRunEntry.workerModel}`
					: `Suite run ${selectedSuiteRunEntry.suiteRunId} is in progress.`,
				status: "Waiting for suite report",
				durationMs: selectedSuiteRunEntry.durationMs,
				secondary: `${selectedSuiteRunEntry.finishedRuns}/${selectedSuiteRunEntry.totalRuns} runs finished`,
			};
		}

		return null;
	});

	let hasSelection = $derived(
		$selectedSuiteName != null ||
			$selectedSuiteRunId != null ||
			$selectedRunDir != null ||
			$selectedBenchId != null ||
			$pendingLaunch != null,
	);
</script>

{#if $reportLoading}
	<div class="flex items-center justify-center h-64 text-foreground-muted">Loading...</div>
{:else if $selectedRunDir && $currentRunReport}
	<RunDetail report={$currentRunReport} />
{:else if $selectedBenchId && $currentBenchReport}
	<BenchDetail report={$currentBenchReport} />
{:else if $selectedSuiteRunId && $currentSuiteReport}
	<SuiteRunDetail report={$currentSuiteReport} />
{:else if pendingView}
	<PendingSelectionView {...pendingView} />
{:else if !$projectsLoading && $projects.length === 0}
	<div class="flex items-center justify-center h-full text-foreground-muted">
		Add a project from the sidebar to browse eval runs.
	</div>
{:else if $reportError}
	<div class="flex items-center justify-center h-64 text-accent-red">{$reportError}</div>
{:else if $selectedSuiteName}
	<SuiteOverview suiteName={$selectedSuiteName} />
{:else if !hasSelection && $activeProject && $launcherConfig}
	<ConfigView config={$launcherConfig} />
{:else if !hasSelection && $activeProject && $sidebarItems.length === 0 && $benchIndex.length === 0}
	<div class="flex items-center justify-center h-full text-foreground-muted">
		No runs yet for {$activeProject.name}.
	</div>
{:else if !hasSelection}
	<div class="flex items-center justify-center h-full text-foreground-muted">
		Select a suite or run from the sidebar.
	</div>
{/if}

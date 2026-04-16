<script lang="ts">
	import { suiteIndex, getSuiteTrendData, getOrLoadSuiteReport } from "../../stores/runs.js";
	import { selectSuiteRun } from "../../stores/selection.js";
	import { scoreColor, deltaColor, formatDelta, formatDate, formatDuration } from "$lib/utils.js";
	import SuiteTrendChart from "$lib/components/SuiteTrendChart.svelte";
	import type { SuiteReport } from "$eval/types.js";

	let { suiteName }: { suiteName: string } = $props();

	let entries = $derived(
		$suiteIndex
			.filter((e) => e.suite === suiteName)
			.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
	);

	let trendEntries = $derived(getSuiteTrendData(suiteName));
	let overviewReports = $state<Record<string, SuiteReport>>({});

	let stats = $derived.by(() => {
		if (entries.length === 0) return null;
		const avgs = entries.map((e) => e.averageOverall);
		const latest = avgs[0] ?? 0;
		const prev = avgs[1];
		return {
			totalRuns: entries.length,
			latest,
			avg: Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10,
			best: Math.max(...avgs),
			worst: Math.min(...avgs),
			trend: prev != null ? Math.round((latest - prev) * 10) / 10 : null,
		};
	});

	let hasModelColumn = $derived(entries.some((entry) => entry.workerModel));

	let chartPoints = $derived.by(() =>
		trendEntries.map((entry, index) => {
			const previous = trendEntries[index - 1];
			const report = overviewReports[entry.suiteRunId];
			const completedAt = new Date(entry.date);
			const delta =
				previous != null ? Math.round((entry.averageOverall - previous.averageOverall) * 10) / 10 : null;

			return {
				suiteRunId: entry.suiteRunId,
				axisLabel: completedAt.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				}),
				tooltipLabel: formatDate(completedAt.toISOString()),
				averageOverall: entry.averageOverall,
				totalRuns: entry.totalRuns,
				hardFailures: entry.hardFailures,
				delta,
				workerModel: report?.workerModel,
				comparison: report?.comparison
					? {
							hardRegressionCount: report.comparison.hardRegressionCount,
							clearRegressionCount: report.comparison.clearRegressionCount,
							driftCount: report.comparison.driftCount,
						}
					: null,
			};
		}),
	);

	let trialTrends = $derived.by(() => {
		if (trendEntries.length === 0) return [];

		const series = new Map<
			string,
			{
				key: string;
				label: string;
				values: Array<number | null>;
				latest: number;
			}
		>();

		for (const [index, entry] of trendEntries.entries()) {
			const report = overviewReports[entry.suiteRunId];
			if (!report) continue;

			const perTrialScores = new Map<string, { label: string; total: number; count: number }>();
			for (const run of report.entries) {
				const key = `${run.trial}/${run.variant}`;
				const existing = perTrialScores.get(key);
				if (existing) {
					existing.total += run.overall;
					existing.count += 1;
					continue;
				}
				perTrialScores.set(key, { label: key, total: run.overall, count: 1 });
			}

			for (const [key, value] of perTrialScores) {
				let line = series.get(key);
				if (!line) {
					line = {
						key,
						label: value.label,
						values: Array.from({ length: trendEntries.length }, () => null),
						latest: -1,
					};
					series.set(key, line);
				}

				const average = Math.round((value.total / value.count) * 10) / 10;
				line.values[index] = average;
				line.latest = average;
			}
		}

		return Array.from(series.values())
			.sort((a, b) => {
				if (b.latest !== a.latest) return b.latest - a.latest;
				return a.label.localeCompare(b.label);
			})
			.slice(0, 10)
			.map(({ key, label, values }) => ({ key, label, values }));
	});

	$effect(() => {
		const suite = suiteName;
		const points = getSuiteTrendData(suite);
		let cancelled = false;
		overviewReports = {};

		if (points.length === 0) {
			return;
		}

		void (async () => {
			const next: Record<string, SuiteReport> = {};
			await Promise.all(
				points.map(async (point) => {
					const report = await getOrLoadSuiteReport(suite, point.suiteRunId);
					if (report) {
						next[point.suiteRunId] = report;
					}
				}),
			);

			if (!cancelled && suiteName === suite) {
				overviewReports = next;
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<h2 class="text-xl font-bold mb-4">Suite: {suiteName}</h2>

{#if stats}
	<div class="flex flex-wrap gap-4 mb-6">
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Runs</dt>
			<dd class="text-lg font-bold">{stats.totalRuns}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Latest</dt>
			<dd class="text-lg font-bold">{stats.latest}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Average</dt>
			<dd class="text-lg font-bold">{stats.avg}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Best</dt>
			<dd class="text-lg font-bold">{stats.best}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Worst</dt>
			<dd class="text-lg font-bold">{stats.worst}</dd>
		</dl>
		{#if stats.trend != null}
			<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
				<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Trend</dt>
				<dd class="text-lg font-bold" style="color: {deltaColor(stats.trend)}">{formatDelta(stats.trend)}</dd>
			</dl>
		{/if}
	</div>
{/if}

<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
	<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle">Score Trend</h3>
		<div class="text-xs text-foreground-muted">Average runs with improvement and regression markers</div>
	</div>
	<SuiteTrendChart points={chartPoints} trialTrends={trialTrends} />
</div>

<div class="bg-background-subtle rounded border border-border-muted p-4">
	<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Run History</h3>
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="text-[10px] uppercase tracking-wider text-foreground-subtle">
					<th class="text-left py-2 pr-4">Date</th>
					<th class="text-center py-2 px-2">Score</th>
					<th class="text-center py-2 px-2">Delta</th>
					<th class="text-center py-2 px-2">Trials</th>
					<th class="text-center py-2 px-2">Failures</th>
					{#if hasModelColumn}
						<th class="text-left py-2 px-2">Model</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each entries as entry, i (entry.suiteRunId)}
					{@const prev = entries[i + 1]}
					{@const delta = prev ? Math.round((entry.averageOverall - prev.averageOverall) * 10) / 10 : null}
					<tr
						class="border-t border-border-muted hover:bg-background-muted cursor-pointer transition-colors"
						onclick={() => selectSuiteRun(suiteName, entry.suiteRunId)}
					>
						<td class="py-2 pr-4 text-foreground-muted">{formatDate(entry.completedAt)}</td>
						<td class="py-2 px-2 text-center">
							<span
								class="inline-block min-w-[2rem] text-center text-xs font-bold rounded px-1.5 py-0.5"
								style="background-color: {scoreColor(entry.averageOverall)}; color: var(--color-background)"
							>
								{entry.averageOverall}
							</span>
						</td>
						<td class="py-2 px-2 text-center">
							{#if delta != null}
								<span class="font-mono text-xs" style="color: {deltaColor(delta)}">{formatDelta(delta)}</span>
							{/if}
						</td>
						<td class="py-2 px-2 text-center text-foreground-muted">{entry.totalRuns}</td>
						<td class="py-2 px-2 text-center text-foreground-muted">{entry.hardFailureCount}</td>
						{#if hasModelColumn}
							<td class="py-2 px-2 text-foreground-subtle font-mono text-xs">{entry.workerModel ?? "--"}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

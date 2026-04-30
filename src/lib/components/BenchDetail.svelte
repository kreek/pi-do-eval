<script lang="ts">
	import {
		benchAverageDelta,
		benchComparisonIds,
		benchDeltaLabel,
		benchEntryDelta,
		benchLayerSummary,
		benchProfileCountLabel,
		benchProfileIds,
		benchProfileLabel,
		benchShortProfileLabel,
	} from "$lib/bench-view.js";
	import { scoreColor, deltaColor, formatDelta, formatDate } from "$lib/utils.js";
	import type { BenchReport } from "$eval/types.js";

	let { report }: { report: BenchReport } = $props();

	let profileIds = $derived(benchProfileIds(report));
	let comparisonIds = $derived(benchComparisonIds(report));
</script>

<div>
	<h2 class="text-xl font-bold mb-1">
		Bench: {report.suite}
		<span class="text-foreground-subtle font-normal text-sm ml-2">{formatDate(report.completedAt)}</span>
	</h2>

	<div class="flex flex-wrap gap-4 mb-6 mt-4">
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Suite</dt>
			<dd class="text-sm font-bold">{report.suite}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Profiles</dt>
			<dd class="text-sm font-bold">{benchProfileCountLabel(report)}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Trials</dt>
			<dd class="text-lg font-bold">{report.entries.length}</dd>
		</dl>
		{#if report.baselineProfileId}
			<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
				<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Baseline</dt>
				<dd class="text-sm font-bold">{benchShortProfileLabel(report, report.baselineProfileId)}</dd>
			</dl>
		{/if}
	</div>

	<!-- Profile averages -->
	<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Profile Averages</h3>
		<div class="flex flex-wrap gap-4">
			{#each profileIds as profileId}
				{@const delta = benchAverageDelta(report, profileId)}
				<dl class="bg-background-muted rounded px-4 py-2">
					<dt class="text-xs font-semibold text-foreground-muted">{benchShortProfileLabel(report, profileId)}</dt>
					<dd class="mt-0.5 text-[10.5px] text-foreground-subtle">{benchLayerSummary(report, profileId)}</dd>
					<dd class="mt-1">
						<span
							class="inline-block min-w-[2.5rem] text-center text-sm font-bold rounded px-2 py-0.5"
							style="background-color: {scoreColor(report.averages[profileId])}; color: var(--color-background)"
						>
							{report.averages[profileId] ?? "--"}
						</span>
						{#if delta != null}
							<span class="ml-2 font-mono text-xs" style="color: {deltaColor(delta)}">{formatDelta(delta)}</span>
						{/if}
					</dd>
				</dl>
			{/each}
		</div>
	</div>

	<!-- Comparison table -->
	<div class="bg-background-subtle rounded border border-border-muted p-4">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Per-Trial Comparison</h3>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-[10px] uppercase tracking-wider text-foreground-subtle">
						<th class="text-left py-2 pr-4">Trial / Variant</th>
						{#each profileIds as profileId}
							<th class="text-center py-2 px-2">
								<span class="text-xs" title={benchProfileLabel(report, profileId)}>
									{benchShortProfileLabel(report, profileId)}
								</span>
							</th>
						{/each}
						{#each comparisonIds as profileId}
							<th class="text-center py-2 px-2">{benchDeltaLabel(report, profileId)}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each report.entries as entry}
						<tr class="border-t border-border-muted">
							<td class="py-2 pr-4 font-medium">{entry.trial}/{entry.variant}</td>
							{#each profileIds as profileId}
								<td class="py-2 px-2 text-center">
									{#if entry.overall[profileId] != null}
										<span
											class="inline-block min-w-[2rem] text-center text-xs font-bold rounded px-1.5 py-0.5"
											style="background-color: {scoreColor(entry.overall[profileId])}; color: var(--color-background)"
										>
											{entry.overall[profileId]}
										</span>
									{:else}
										<span class="text-foreground-subtle">--</span>
									{/if}
								</td>
							{/each}
							{#each comparisonIds as profileId}
								{@const delta = benchEntryDelta(report, entry, profileId)}
								<td class="py-2 px-2 text-center">
									{#if delta != null}
										<span class="font-mono text-xs" style="color: {deltaColor(delta)}">{formatDelta(delta)}</span>
									{:else}
										<span class="text-foreground-subtle">--</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

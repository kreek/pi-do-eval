<script lang="ts">
	import { scoreColor, deltaColor, formatDelta, formatDate, shortModelName } from "$lib/utils.js";
	import type { BenchReport } from "$eval/types.js";

	let { report }: { report: BenchReport } = $props();

	let showDelta = $derived(report.models.length >= 2);
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
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Models</dt>
			<dd class="text-lg font-bold">{report.models.length}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Trials</dt>
			<dd class="text-lg font-bold">{report.entries.length}</dd>
		</dl>
	</div>

	<!-- Model averages -->
	<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Model Averages</h3>
		<div class="flex flex-wrap gap-4">
			{#each report.models as model}
				<dl class="bg-background-muted rounded px-4 py-2">
					<dt class="text-xs font-mono text-foreground-muted">{shortModelName(model)}</dt>
					<dd class="mt-1">
						<span
							class="inline-block min-w-[2.5rem] text-center text-sm font-bold rounded px-2 py-0.5"
							style="background-color: {scoreColor(report.averages[model])}; color: var(--color-background)"
						>
							{report.averages[model] ?? "--"}
						</span>
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
						{#each report.models as model}
							<th class="text-center py-2 px-2">
								<code class="text-xs">{shortModelName(model)}</code>
							</th>
						{/each}
						{#if showDelta}
							<th class="text-center py-2 px-2">Delta</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each report.entries as entry}
						{@const first = entry.overall[report.models[0] ?? ""]}
						{@const last = entry.overall[report.models[report.models.length - 1] ?? ""]}
						{@const delta = first != null && last != null ? Math.round((first - last) * 10) / 10 : null}
						<tr class="border-t border-border-muted">
							<td class="py-2 pr-4 font-medium">{entry.trial}/{entry.variant}</td>
							{#each report.models as model}
								<td class="py-2 px-2 text-center">
									{#if entry.overall[model] != null}
										<span
											class="inline-block min-w-[2rem] text-center text-xs font-bold rounded px-1.5 py-0.5"
											style="background-color: {scoreColor(entry.overall[model])}; color: var(--color-background)"
										>
											{entry.overall[model]}
										</span>
									{:else}
										<span class="text-foreground-subtle">--</span>
									{/if}
								</td>
							{/each}
							{#if showDelta}
								<td class="py-2 px-2 text-center">
									{#if delta != null}
										<span class="font-mono text-xs" style="color: {deltaColor(delta)}">{formatDelta(delta)}</span>
									{:else}
										<span class="text-foreground-subtle">--</span>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

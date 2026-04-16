<script lang="ts">
	import type { LauncherConfig } from "$eval/types.js";
	import { formatDuration } from "$lib/utils.js";

	let { config }: { config: LauncherConfig } = $props();

	function formatModel(m: { provider?: string; model?: string } | undefined): string {
		if (!m || (!m.provider && !m.model)) return "agent default";
		if (m.provider && m.model) return `${m.provider}/${m.model}`;
		return m.model ?? m.provider ?? "agent default";
	}

	function formatTokens(n: number | undefined): string {
		if (n == null) return "--";
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
		return String(n);
	}

	let workerLabel = $derived(formatModel(config.defaultWorker));
	let judgeLabel = $derived(formatModel(config.judge));
	let hasTimeouts = $derived(config.timeouts && (config.timeouts.workerMs || config.timeouts.inactivityMs || config.timeouts.judgeMs));
	let hasBudgets = $derived(config.budgets && Object.values(config.budgets).some(v => v != null));
</script>

<div>
	<h2 class="text-xl font-bold mb-6">Eval Configuration</h2>

	<!-- Models -->
	<div class="bg-background-subtle rounded border border-border-muted p-4 mb-4">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Models</h3>
		<div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
			<span class="text-foreground-muted">Worker</span>
			<code class="text-foreground">{workerLabel}</code>
			<span class="text-foreground-muted">Judge</span>
			<code class="text-foreground">{judgeLabel}</code>
			{#if config.models.length > 0}
				<span class="text-foreground-muted">Bench models</span>
				<div class="flex flex-wrap gap-1.5">
					{#each config.models as m}
						<code class="text-xs bg-background-muted px-1.5 py-0.5 rounded border border-border-muted">{formatModel(m)}</code>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Settings -->
	<div class="bg-background-subtle rounded border border-border-muted p-4 mb-4">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Settings</h3>
		<div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
			{#if config.epochs}
				<span class="text-foreground-muted">Epochs</span>
				<span>{config.epochs}</span>
			{/if}
			{#if config.regressionThreshold}
				<span class="text-foreground-muted">Regression threshold</span>
				<span>{config.regressionThreshold} points</span>
			{/if}
			{#if hasTimeouts}
				<span class="text-foreground-muted">Worker timeout</span>
				<span>{config.timeouts?.workerMs ? formatDuration(config.timeouts.workerMs) : "--"}</span>
				<span class="text-foreground-muted">Inactivity timeout</span>
				<span>{config.timeouts?.inactivityMs ? formatDuration(config.timeouts.inactivityMs) : "--"}</span>
				<span class="text-foreground-muted">Judge timeout</span>
				<span>{config.timeouts?.judgeMs ? formatDuration(config.timeouts.judgeMs) : "--"}</span>
			{/if}
		</div>
	</div>

	<!-- Budgets -->
	{#if hasBudgets}
		<div class="bg-background-subtle rounded border border-border-muted p-4 mb-4">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Budgets</h3>
			<div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
				{#if config.budgets?.maxInputTokens != null}
					<span class="text-foreground-muted">Max input tokens</span>
					<span>{formatTokens(config.budgets.maxInputTokens)}</span>
				{/if}
				{#if config.budgets?.maxOutputTokens != null}
					<span class="text-foreground-muted">Max output tokens</span>
					<span>{formatTokens(config.budgets.maxOutputTokens)}</span>
				{/if}
				{#if config.budgets?.maxTotalTokens != null}
					<span class="text-foreground-muted">Max total tokens</span>
					<span>{formatTokens(config.budgets.maxTotalTokens)}</span>
				{/if}
				{#if config.budgets?.maxDurationMs != null}
					<span class="text-foreground-muted">Max duration</span>
					<span>{formatDuration(config.budgets.maxDurationMs)}</span>
				{/if}
				{#if config.budgets?.maxToolCalls != null}
					<span class="text-foreground-muted">Max tool calls</span>
					<span>{config.budgets.maxToolCalls}</span>
				{/if}
				{#if config.budgets?.maxBlockedCalls != null}
					<span class="text-foreground-muted">Max blocked calls</span>
					<span>{config.budgets.maxBlockedCalls}</span>
				{/if}
				{#if config.budgets?.maxFileWrites != null}
					<span class="text-foreground-muted">Max file writes</span>
					<span>{config.budgets.maxFileWrites}</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Suites -->
	<div class="bg-background-subtle rounded border border-border-muted p-4 mb-4">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Suites</h3>
		<div class="space-y-3">
			{#each Object.entries(config.suites) as [name, entries]}
				<div>
					<div class="flex items-center gap-2 mb-1">
						<span class="font-semibold text-sm">{name}</span>
						<span class="text-xs text-foreground-subtle">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
					</div>
					<div class="flex flex-wrap gap-1">
						{#each entries as entry}
							<code class="text-xs bg-background-muted px-1.5 py-0.5 rounded border border-border-muted">{entry.trial}/{entry.variant}</code>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Trials -->
	<div class="bg-background-subtle rounded border border-border-muted p-4">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">
			Trials
			<span class="font-normal normal-case text-foreground-muted">({config.trials.length})</span>
		</h3>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-[10px] uppercase tracking-wider text-foreground-subtle">
						<th class="text-left py-2 pr-4">Trial</th>
						<th class="text-left py-2 pr-4">Description</th>
						<th class="text-left py-2">Variants</th>
					</tr>
				</thead>
				<tbody>
					{#each config.trials as trial}
						<tr class="border-t border-border-muted">
							<td class="py-2 pr-4 font-medium font-mono text-xs">{trial.name}</td>
							<td class="py-2 pr-4 text-foreground-muted">{trial.description}</td>
							<td class="py-2">
								<div class="flex flex-wrap gap-1">
									{#each trial.variants as variant}
										<code class="text-xs bg-background-muted px-1.5 py-0.5 rounded border border-border-muted">{variant}</code>
									{/each}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

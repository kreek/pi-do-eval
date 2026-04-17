<script lang="ts">
	import { scoreColor, formatDuration, formatMetricLabel } from "$lib/utils.js";
	import type { FileWriteRecord, PluginEvent, ToolCallRecord } from "$eval/types.js";
	import type { RunDetailData } from "../../stores/runs.js";

	let { report }: { report: RunDetailData } = $props();

	type TimelineEvent =
		| { kind: "tool"; timestamp: number; data: ToolCallRecord }
		| { kind: "file"; timestamp: number; data: FileWriteRecord }
		| { kind: "plugin"; timestamp: number; data: PluginEvent };

	let agentSnapshot = $derived(report.meta.agentSnapshot ?? null);
	let environment = $derived(report.meta.environment ?? null);

	function formatModel(m: { provider?: string; model?: string } | undefined): string {
		if (!m) return "—";
		if (m.provider && m.model) return `${m.provider}/${m.model}`;
		return m.model ?? m.provider ?? "—";
	}

	function formatMs(ms: number | undefined): string {
		if (ms == null) return "—";
		if (ms < 1000) return `${ms}ms`;
		const secs = Math.round(ms / 1000);
		if (secs < 60) return `${secs}s`;
		return `${Math.round(secs / 60)}m`;
	}

	let scoreEntries = $derived(report.scores ? Object.entries(report.scores.deterministic) : []);
	let judgeEntries = $derived(report.scores?.judge ? Object.entries(report.scores.judge) : []);
	let overallScore = $derived(report.scores?.overall ?? null);
	let findings = $derived(report.findings ?? []);
	let timeline = $derived.by(() => {
		const session = report.session;
		const events: TimelineEvent[] = [];
		for (const toolCall of session.toolCalls ?? []) {
			events.push({ kind: "tool", timestamp: toolCall.timestamp, data: toolCall });
		}
		for (const fileWrite of session.fileWrites ?? []) {
			events.push({ kind: "file", timestamp: fileWrite.timestamp, data: fileWrite });
		}
		for (const pluginEvent of session.pluginEvents ?? []) {
			events.push({ kind: "plugin", timestamp: pluginEvent.timestamp, data: pluginEvent });
		}
		events.sort((a, b) => a.timestamp - b.timestamp);
		return events;
	});

	function bar(score: number): string {
		const pct = Math.max(0, Math.min(100, score));
		return `${pct}%`;
	}

	function formatTimestamp(ts: number | undefined): string {
		if (!ts) return "--";
		return new Date(ts).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	}

	function formatArgs(args: Record<string, unknown> | undefined): string {
		if (!args) return "";
		if (typeof args.command === "string") return args.command;
		if (typeof args.path === "string") return args.path;
		const json = JSON.stringify(args);
		return json.length > 180 ? `${json.slice(0, 177)}...` : json;
	}

	function truncate(text: string | undefined, length: number): string {
		if (!text) return "";
		return text.length > length ? `${text.slice(0, length - 3)}...` : text;
	}

	function formatPluginEvent(event: PluginEvent): string {
		const payload =
			typeof event.data === "string" ? event.data : JSON.stringify(event.data);
		return `${event.type}: ${payload}`;
	}
</script>

<div class="max-w-[800px]">
	<h2 class="text-xl font-bold mb-1">
		<span>{report.meta.trial}</span>
		<span class="text-foreground-subtle font-normal">/</span>
		<span>{report.meta.variant}</span>
	</h2>

	<div class="flex flex-wrap gap-4 mb-6 mt-4">
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Status</dt>
			<dd class="text-sm font-bold">{report.meta.status}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Duration</dt>
			<dd class="text-sm font-bold">{formatDuration(report.meta.durationMs)}</dd>
		</dl>
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Worker</dt>
			<dd class="text-sm font-mono">{report.meta.workerModel || "--"}</dd>
		</dl>
		{#if report.meta.judgeModel}
			<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
				<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Judge</dt>
				<dd class="text-sm font-mono">{report.meta.judgeModel}</dd>
			</dl>
		{/if}
		<dl class="bg-background-subtle rounded px-4 py-2 border border-border-muted">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Tokens</dt>
			<dd class="text-sm font-bold">
				{(report.session.tokenUsage?.input ?? 0) + (report.session.tokenUsage?.output ?? 0)}
			</dd>
		</dl>
	</div>

	<!-- Agent snapshot + environment (collapsible) -->
	{#if agentSnapshot || environment || report.meta.runId}
		<details class="bg-background-subtle rounded border border-border-muted mb-6">
			<summary class="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
				Agent Snapshot & Environment
			</summary>
			<div class="grid grid-cols-1 gap-4 border-t border-border-muted px-4 py-3 md:grid-cols-2">
				<div>
					<h4 class="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Agent</h4>
					<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
						{#if report.meta.runId}
							<dt class="text-foreground-muted">Run ID</dt>
							<dd class="font-mono text-[10.5px] text-foreground break-all">{report.meta.runId}</dd>
						{/if}
						{#if agentSnapshot?.worker}
							<dt class="text-foreground-muted">Worker</dt>
							<dd class="font-mono text-[11px] text-foreground">{formatModel(agentSnapshot.worker)}</dd>
						{/if}
						{#if agentSnapshot?.judge}
							<dt class="text-foreground-muted">Judge</dt>
							<dd class="font-mono text-[11px] text-foreground">{formatModel(agentSnapshot.judge)}</dd>
						{/if}
						{#if agentSnapshot?.timeouts?.workerMs}
							<dt class="text-foreground-muted">Worker timeout</dt>
							<dd class="text-foreground">{formatMs(agentSnapshot.timeouts.workerMs)}</dd>
						{/if}
						{#if agentSnapshot?.timeouts?.inactivityMs}
							<dt class="text-foreground-muted">Inactivity timeout</dt>
							<dd class="text-foreground">{formatMs(agentSnapshot.timeouts.inactivityMs)}</dd>
						{/if}
						{#if agentSnapshot?.epochs}
							<dt class="text-foreground-muted">Epochs</dt>
							<dd class="text-foreground">{agentSnapshot.epochs}</dd>
						{/if}
						{#if agentSnapshot?.regressionThreshold != null}
							<dt class="text-foreground-muted">Regression threshold</dt>
							<dd class="text-foreground">{agentSnapshot.regressionThreshold}</dd>
						{/if}
					</dl>
				</div>
				{#if environment}
					<div>
						<h4 class="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Environment</h4>
						<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
							<dt class="text-foreground-muted">Node</dt>
							<dd class="font-mono text-[11px] text-foreground">{environment.nodeVersion}</dd>
							<dt class="text-foreground-muted">Platform</dt>
							<dd class="font-mono text-[11px] text-foreground">{environment.platform}</dd>
							{#if environment.piVersion}
								<dt class="text-foreground-muted">Pi</dt>
								<dd class="font-mono text-[11px] text-foreground">{environment.piVersion}</dd>
							{/if}
						</dl>
					</div>
				{/if}
			</div>
		</details>
	{/if}

	<!-- Score bars -->
	{#if report.scores}
		<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
			<div class="flex items-center gap-6 mb-4">
				<span
					class="text-3xl font-bold rounded px-3 py-1"
					style="background-color: {scoreColor(overallScore)}; color: var(--color-background)"
				>
					{overallScore}
				</span>
				<span class="text-sm text-foreground-muted">Overall Score</span>
			</div>

			<div class="space-y-2">
				{#each scoreEntries as [key, value]}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-32 text-foreground-muted truncate">{formatMetricLabel(key)}</span>
						<div class="flex-1 h-4 bg-background-muted rounded overflow-hidden">
							<div
								class="h-full rounded transition-all"
								style="width: {bar(value)}; background-color: {scoreColor(value)}"
							></div>
						</div>
						<span class="w-8 text-right font-mono text-xs">{value}</span>
					</div>
				{/each}

				{#each judgeEntries as [key, value]}
					<div class="flex items-center gap-3 text-sm">
						<span class="w-32 text-foreground-muted truncate"
							>{formatMetricLabel(key)}
							<span class="text-foreground-subtle text-xs">(judge)</span></span
						>
						<div class="flex-1 h-4 bg-background-muted rounded overflow-hidden">
							<div
								class="h-full rounded transition-all"
								style="width: {bar(value)}; background-color: {scoreColor(value)}"
							></div>
						</div>
						<span class="w-8 text-right font-mono text-xs">{value}</span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2">Live Run</h3>
			<p class="text-sm text-foreground-muted">
				Session activity is streaming below. Scores and judge output will appear after the final
				report is written.
			</p>
		</div>
	{/if}

	<!-- Scoring issues -->
	{#if report.scores?.issues && report.scores.issues.length > 0}
		<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2">Scoring Issues</h3>
			<ul class="text-sm space-y-1">
				{#each report.scores.issues as issue}
					<li class="text-accent-orange">{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Session summary -->
	<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2">Session</h3>
		<div class="flex flex-wrap gap-6 text-sm text-foreground-muted">
			<span>Tool calls: {report.session.toolCalls?.length ?? 0}</span>
			<span>File writes: {report.session.fileWrites?.length ?? 0}</span>
			<span>Tokens: {(report.session.tokenUsage?.input ?? 0) + (report.session.tokenUsage?.output ?? 0)}</span>
			<span>Plugin events: {report.session.pluginEvents?.length ?? 0}</span>
		</div>
	</div>

	<!-- Findings -->
	{#if findings.length > 0}
		<div class="bg-background-subtle rounded border border-border-muted p-4 mb-6">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-2">Findings</h3>
			<ul class="text-sm space-y-1">
				{#each findings as finding}
					<li class="text-foreground-muted">{finding}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Judge reasoning -->
	{#if report.judgeResult}
		<div class="bg-background-subtle rounded border border-border-muted p-4">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Judge Reasoning</h3>
			<div class="space-y-3">
				{#each Object.entries(report.judgeResult.reasons) as [key, reason]}
					{@const score = report.judgeResult?.scores[key]}
					<div class="text-sm">
						<span class="font-semibold">{formatMetricLabel(key)}</span>
						{#if score != null}
							<span class="text-foreground-subtle">({score}/100)</span>
						{/if}
						<p class="text-foreground-muted mt-0.5">{reason}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Session timeline -->
	{#if timeline.length > 0}
		<div class="bg-background-subtle rounded border border-border-muted p-4">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-foreground-subtle mb-3">Timeline</h3>
			<div class="space-y-2 max-h-[520px] overflow-y-auto">
				{#each timeline as event, index (index)}
					<div class="flex gap-3 rounded border border-border-muted bg-background px-3 py-2">
						<span class="w-20 shrink-0 text-[11px] font-mono text-foreground-subtle">
							{formatTimestamp(event.timestamp)}
						</span>
						<span
							class="w-14 shrink-0 rounded px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider"
							class:text-accent-blue={event.kind === "tool"}
							class:text-accent-green={event.kind === "file"}
							class:text-accent-purple={event.kind === "plugin"}
						>
							{event.kind}
						</span>
						<div class="min-w-0 flex-1 text-sm">
							{#if event.kind === "tool"}
								<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
									<span class="font-semibold">{event.data.name}</span>
									<span class="text-foreground-muted break-all">{formatArgs(event.data.arguments)}</span>
								</div>
								{#if event.data.resultText}
									<p class="mt-1 text-xs text-foreground-subtle whitespace-pre-wrap">
										{truncate(event.data.resultText, 240)}
									</p>
								{/if}
							{:else if event.kind === "file"}
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-mono text-xs break-all">{event.data.path}</span>
									{#each event.data.labels as label}
										<span class="rounded border border-border-default px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground-subtle">
											{label}
										</span>
									{/each}
								</div>
							{:else}
								<p class="text-accent-purple break-all">{formatPluginEvent(event.data)}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

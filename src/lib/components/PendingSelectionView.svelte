<script lang="ts">
	import { formatDuration } from "$lib/utils.js";

	let {
		eyebrow,
		title,
		description,
		status,
		durationMs,
		secondary,
	}: {
		eyebrow: string;
		title: string;
		description: string;
		status: string;
		durationMs?: number;
		secondary?: string;
	} = $props();
</script>

<div class="max-w-3xl">
	<div class="inline-flex items-center gap-2 rounded-full border border-border-default bg-background-subtle px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground-subtle">
		<span class="h-2 w-2 rounded-full bg-accent-green animate-pulse"></span>
		{eyebrow}
	</div>

	<h2 class="mt-5 text-2xl font-bold">{title}</h2>
	<p class="mt-2 text-sm text-foreground-muted">{description}</p>

	<div class="mt-6 grid gap-3 sm:grid-cols-3">
		<dl class="rounded border border-border-muted bg-background-subtle px-4 py-3">
			<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Status</dt>
			<dd class="mt-1 text-sm font-semibold">{status}</dd>
		</dl>
		{#if durationMs != null}
			<dl class="rounded border border-border-muted bg-background-subtle px-4 py-3">
				<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Duration</dt>
				<dd class="mt-1 text-sm font-semibold">{formatDuration(durationMs)}</dd>
			</dl>
		{/if}
		{#if secondary}
			<dl class="rounded border border-border-muted bg-background-subtle px-4 py-3">
				<dt class="text-[10px] uppercase tracking-wider text-foreground-subtle">Progress</dt>
				<dd class="mt-1 text-sm font-semibold">{secondary}</dd>
			</dl>
		{/if}
	</div>
</div>

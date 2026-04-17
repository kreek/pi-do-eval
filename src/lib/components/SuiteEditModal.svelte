<script lang="ts">
	import { tick } from "svelte";
	import type { LauncherConfig, LauncherSuiteDef } from "$eval/types.js";

	type SaveResult = { ok: true } | { ok: false; error: string };

	let {
		open = $bindable(false),
		mode,
		existing,
		trials,
		onsave,
	}: {
		open?: boolean;
		mode: "create" | "edit";
		existing?: LauncherSuiteDef | null;
		trials: LauncherConfig["trials"];
		onsave: (payload: {
			originalName?: string;
			name: string;
			description: string;
			regressionThreshold: number | undefined;
			trials: Array<{ trial: string; variant: string }>;
		}) => Promise<SaveResult>;
	} = $props();

	let name = $state("");
	let description = $state("");
	let threshold = $state<string>("");
	let selected = $state(new Set<string>());
	let saving = $state(false);
	let error = $state<string | null>(null);
	let nameInput = $state<HTMLInputElement | null>(null);
	let filter = $state("");

	function keyOf(trial: string, variant: string): string {
		return `${trial}::${variant}`;
	}

	let totalVariantCount = $derived(
		trials.reduce((sum, trial) => sum + trial.variants.length, 0),
	);

	let sortedTrials = $derived([...trials].sort((a, b) => a.name.localeCompare(b.name)));

	let filteredTrials = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return sortedTrials;
		return sortedTrials.filter((trial) => {
			if (trial.name.toLowerCase().includes(q)) return true;
			return trial.variants.some((variant) => variant.toLowerCase().includes(q));
		});
	});

	function trialSelectionCount(trial: { name: string; variants: string[] }): number {
		let count = 0;
		for (const variant of trial.variants) {
			if (selected.has(keyOf(trial.name, variant))) count++;
		}
		return count;
	}

	function toggleAllForTrial(trial: { name: string; variants: string[] }) {
		const next = new Set(selected);
		const count = trialSelectionCount(trial);
		if (count === trial.variants.length) {
			for (const variant of trial.variants) next.delete(keyOf(trial.name, variant));
		} else {
			for (const variant of trial.variants) next.add(keyOf(trial.name, variant));
		}
		selected = next;
	}

	function selectAll() {
		const next = new Set<string>();
		for (const trial of trials) {
			for (const variant of trial.variants) next.add(keyOf(trial.name, variant));
		}
		selected = next;
	}

	function clearAll() {
		selected = new Set();
	}

	$effect(() => {
		if (!open) return;
		error = null;
		filter = "";
		if (mode === "edit" && existing) {
			name = existing.name;
			description = existing.description ?? "";
			threshold = existing.regressionThreshold != null ? String(existing.regressionThreshold) : "";
			selected = new Set(existing.trials.map(({ trial, variant }) => keyOf(trial, variant)));
		} else {
			name = "";
			description = "";
			threshold = "";
			selected = new Set();
		}
		void tick().then(() => nameInput?.focus());
	});

	function toggle(trial: string, variant: string) {
		const key = keyOf(trial, variant);
		const next = new Set(selected);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selected = next;
	}

	async function submit() {
		error = null;
		const trimmedName = name.trim();
		if (!trimmedName) {
			error = "Name is required";
			return;
		}
		if (selected.size === 0) {
			error = "Select at least one trial/variant";
			return;
		}
		const thresholdValue = threshold.trim() === "" ? undefined : Number(threshold);
		if (thresholdValue !== undefined && !Number.isFinite(thresholdValue)) {
			error = "Regression threshold must be a number";
			return;
		}

		const payloadTrials: Array<{ trial: string; variant: string }> = [];
		for (const trial of trials) {
			for (const variant of trial.variants) {
				if (selected.has(keyOf(trial.name, variant))) {
					payloadTrials.push({ trial: trial.name, variant });
				}
			}
		}

		saving = true;
		try {
			const result = await onsave({
				originalName: mode === "edit" ? existing?.name : undefined,
				name: trimmedName,
				description: description.trim(),
				regressionThreshold: thresholdValue,
				trials: payloadTrials,
			});
			if (result.ok) {
				open = false;
			} else {
				error = result.error;
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === "Escape" && !saving) open = false;
	}}
/>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]">
		<div
			class="w-full max-w-2xl overflow-hidden rounded border border-border-default bg-background-subtle shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="suite-edit-title"
		>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				<div class="border-b border-border-default px-4 py-3">
					<h2 id="suite-edit-title" class="text-sm font-semibold tracking-wide text-foreground">
						{mode === "edit" ? "Edit Suite" : "New Suite"}
					</h2>
				</div>

				<div class="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<label class="block">
							<span class="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Name</span>
							<input
								bind:this={nameInput}
								bind:value={name}
								class="mt-1 w-full rounded border border-border-default bg-background-muted px-2 py-1.5 font-mono text-[12px] text-foreground"
								placeholder="smoke"
							/>
						</label>
						<label class="block">
							<span class="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Regression threshold</span>
							<input
								bind:value={threshold}
								class="mt-1 w-full rounded border border-border-default bg-background-muted px-2 py-1.5 text-[12px] text-foreground"
								placeholder="3"
								type="number"
								step="0.5"
							/>
						</label>
					</div>
					<label class="block">
						<span class="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Description</span>
						<input
							bind:value={description}
							class="mt-1 w-full rounded border border-border-default bg-background-muted px-2 py-1.5 text-[12px] text-foreground"
							placeholder="Quick smoke test"
						/>
					</label>

					<div>
						<div class="mb-1.5 flex flex-wrap items-center gap-2">
							<span class="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
								Trials / Variants
							</span>
							<span class="text-[11px] text-foreground-muted">
								<span class="font-semibold text-foreground">{selected.size}</span> of {totalVariantCount}
								variants selected
							</span>
							<div class="ml-auto flex items-center gap-1">
								<button
									type="button"
									class="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
									onclick={selectAll}
								>
									Select all
								</button>
								<button
									type="button"
									class="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
									onclick={clearAll}
									disabled={selected.size === 0}
								>
									Clear
								</button>
							</div>
						</div>
						<input
							bind:value={filter}
							class="mb-2 w-full rounded border border-border-default bg-background-muted px-2 py-1.5 text-[12px] text-foreground placeholder:text-foreground-subtle"
							placeholder="Filter trials or variants…"
							type="search"
						/>
						<div class="rounded border border-border-default bg-background">
							{#each filteredTrials as trial, trialIndex (trial.name)}
								{@const trialCount = trialSelectionCount(trial)}
								{@const allSelected = trialCount === trial.variants.length && trial.variants.length > 0}
								{@const someSelected = trialCount > 0 && !allSelected}
								<div
									class="grid grid-cols-[180px_1fr] gap-3 px-2 py-1.5 {trialIndex > 0
										? 'border-t border-border-muted'
										: ''}"
								>
									<label
										class="flex min-w-0 cursor-pointer items-start gap-2 py-1 pr-1"
										title={trial.name}
									>
										<input
											type="checkbox"
											class="mt-0.5 accent-accent-blue"
											checked={allSelected}
											indeterminate={someSelected}
											onchange={() => toggleAllForTrial(trial)}
										/>
										<span class="min-w-0 flex-1">
											<span
												class="block truncate text-[12px] font-semibold"
												class:text-foreground={trialCount > 0}
												class:text-foreground-muted={trialCount === 0}
											>
												{trial.name}
											</span>
											<span class="block text-[10.5px] text-foreground-subtle">
												{trialCount}/{trial.variants.length}
											</span>
										</span>
									</label>
									<div
										class="grid gap-1"
										style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));"
									>
										{#each trial.variants as variant (variant)}
											{@const key = keyOf(trial.name, variant)}
											{@const isSelected = selected.has(key)}
											<label
												class="flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors"
												class:border-accent-blue={isSelected}
												class:bg-accent-blue={isSelected}
												class:text-background={isSelected}
												class:border-border-muted={!isSelected}
												class:text-foreground-muted={!isSelected}
												class:hover:border-foreground-subtle={!isSelected}
												class:hover:text-foreground={!isSelected}
											>
												<input
													type="checkbox"
													class="accent-accent-blue"
													checked={isSelected}
													onchange={() => toggle(trial.name, variant)}
												/>
												<span class="truncate" title={variant}>{variant}</span>
											</label>
										{/each}
									</div>
								</div>
							{:else}
								<div class="px-3 py-4 text-center text-[11px] text-foreground-muted">
									No trials match "{filter}"
								</div>
							{/each}
						</div>
					</div>

					{#if error}
						<p class="text-[11px] text-accent-red">{error}</p>
					{/if}
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border-default px-4 py-3">
					<button
						type="button"
						class="rounded border border-border-default px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground disabled:opacity-40"
						disabled={saving}
						onclick={() => (open = false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded bg-accent-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-background transition-colors hover:brightness-110 disabled:opacity-40"
						disabled={saving}
					>
						{saving ? "Saving…" : mode === "edit" ? "Save" : "Create"}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

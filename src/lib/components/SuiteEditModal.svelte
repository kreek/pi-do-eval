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

	function keyOf(trial: string, variant: string): string {
		return `${trial}::${variant}`;
	}

	$effect(() => {
		if (!open) return;
		error = null;
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
						<div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
							Trials / Variants
						</div>
						<div class="rounded border border-border-default bg-background-muted p-2">
							{#each trials as trial (trial.name)}
								<div class="mb-1 last:mb-0">
									<div class="text-[11px] font-semibold text-foreground">{trial.name}</div>
									<div class="mt-0.5 flex flex-wrap gap-1">
										{#each trial.variants as variant (variant)}
											{@const key = keyOf(trial.name, variant)}
											<label
												class="inline-flex items-center gap-1 rounded border border-border-muted bg-background px-2 py-0.5 text-[11px] cursor-pointer"
												class:border-accent-blue={selected.has(key)}
												class:text-accent-blue={selected.has(key)}
											>
												<input
													type="checkbox"
													class="accent-accent-blue"
													checked={selected.has(key)}
													onchange={() => toggle(trial.name, variant)}
												/>
												{variant}
											</label>
										{/each}
									</div>
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

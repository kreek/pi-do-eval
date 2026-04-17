<script lang="ts">
	import { tick } from "svelte";
	import {
		activeProject,
		activeProjectId,
		addProject,
		projects,
		projectsBusy,
		projectsError,
		removeProject,
		selectActiveProject,
	} from "../../stores/projects.js";

	let addOpen = $state(false);
	let confirmRemove = $state(false);
	let projectPath = $state("");
	let projectPathInput = $state<HTMLInputElement | null>(null);

	async function openAddModal() {
		confirmRemove = false;
		addOpen = true;
		await tick();
		projectPathInput?.focus();
	}

	function closeAddModal() {
		if ($projectsBusy) return;
		addOpen = false;
		projectPath = "";
	}

	async function submitAddProject() {
		const trimmedPath = projectPath.trim();
		if (!trimmedPath) return;

		await addProject(trimmedPath);
		if (!$projectsError) {
			closeAddModal();
		}
	}

	async function removeActiveProject() {
		if (!$activeProject) return;
		await removeProject($activeProject.id);
		confirmRemove = false;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (addOpen && event.key === "Escape") closeAddModal();
	}}
/>

<div class="border-b border-border-default">
	<div class="flex items-center gap-2 px-4 py-2">
		<span class="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Project</span>
		<button
			type="button"
			class="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
			onclick={() => void openAddModal()}
		>
			Add
		</button>
		{#if $activeProject}
			<button
				type="button"
				class="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
				aria-expanded={confirmRemove}
				onclick={() => (confirmRemove = !confirmRemove)}
			>
				Remove
			</button>
		{/if}
	</div>

	{#if confirmRemove && $activeProject}
		<div class="px-4 pb-3 flex items-center gap-2 text-[10px] text-foreground-muted">
			<span class="flex-1 truncate">Remove {$activeProject.name} from the viewer?</span>
			<button
				type="button"
				class="rounded border border-border-default px-2 py-0.5 font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
				onclick={() => void removeActiveProject()}
			>
				Confirm
			</button>
			<button
				type="button"
				class="rounded border border-border-default px-2 py-0.5 font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
				onclick={() => (confirmRemove = false)}
			>
				Cancel
			</button>
		</div>
	{/if}

	{#if $projects.length > 0}
		<div class="px-4 pb-3">
			<select
				class="w-full rounded border border-border-default bg-background-muted px-2 py-1.5 text-[12px] text-foreground"
				value={$activeProjectId ?? ""}
				onchange={(event) => void selectActiveProject((event.currentTarget as HTMLSelectElement).value)}
			>
				{#each $projects as project}
					<option value={project.id}>{project.name}</option>
				{/each}
			</select>
			{#if $activeProject}
				<p class="mt-1 truncate text-[10px] text-foreground-muted" title={$activeProject.evalDir}>
					{$activeProject.evalDir}
				</p>
			{/if}
		</div>
	{/if}

	{#if $projects.length === 0}
		<div class="px-4 pb-3 text-[10px] text-foreground-muted">
			Add a project to start browsing eval runs.
		</div>
	{/if}

	{#if $projectsError}
		<p class="px-4 pb-3 text-xs text-accent-red">{$projectsError}</p>
	{/if}
</div>

{#if addOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]">
		<div
			class="w-full max-w-lg rounded border border-border-default bg-background-subtle shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-project-title"
		>
			<form
			onsubmit={(event) => {
				event.preventDefault();
				void submitAddProject();
			}}
				>
				<div class="border-b border-border-default px-4 py-3">
					<h2 id="add-project-title" class="text-sm font-semibold tracking-wide text-foreground">
						Add Project
					</h2>
					<p class="mt-1 text-[11px] text-foreground-muted">
						Pass a repo root to use <code>eval/</code> by convention, or point directly at an eval dir.
					</p>
				</div>

				<div class="px-4 py-4">
					<label
						for="add-project-path"
						class="block text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle"
					>
						Path
					</label>
					<input
						id="add-project-path"
						bind:this={projectPathInput}
						class="mt-2 w-full rounded border border-border-default bg-background-muted px-3 py-2 text-[12px] text-foreground placeholder:text-foreground-subtle"
						type="text"
						bind:value={projectPath}
						placeholder="~/sandbox/pi-tdd"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-border-default px-4 py-3">
					<button
						type="button"
						class="rounded border border-border-default px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground disabled:opacity-40"
						disabled={$projectsBusy}
						onclick={closeAddModal}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded bg-accent-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-background transition-colors hover:brightness-110 disabled:opacity-40"
						disabled={!projectPath.trim() || $projectsBusy}
					>
						{$projectsBusy ? "Adding..." : "Add Project"}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

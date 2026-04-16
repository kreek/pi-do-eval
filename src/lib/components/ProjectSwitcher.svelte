<script lang="ts">
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
	let projectPath = $state("");

	async function submitAddProject() {
		const trimmedPath = projectPath.trim();
		if (!trimmedPath) return;

		await addProject(trimmedPath);
		if (!$projectsError) {
			projectPath = "";
			addOpen = false;
		}
	}

	async function removeActiveProject() {
		if (!$activeProject) return;
		if (!window.confirm(`Remove ${$activeProject.name} from the viewer?`)) return;
		await removeProject($activeProject.id);
	}
</script>

<div class="border-b border-border-default">
	<div class="flex items-center gap-2 px-3 py-2">
		<span class="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">Project</span>
		<button
			type="button"
			class="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
			onclick={() => (addOpen = !addOpen)}
		>
			{addOpen ? "Close" : "Add"}
		</button>
		{#if $activeProject}
			<button
				type="button"
				class="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
				onclick={() => void removeActiveProject()}
			>
				Remove
			</button>
		{/if}
	</div>

	{#if $projects.length > 0}
		<div class="px-3 pb-3">
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

	{#if addOpen || $projects.length === 0}
		<form
			class="space-y-2 px-3 pb-3"
			onsubmit={(event) => {
				event.preventDefault();
				void submitAddProject();
			}}
		>
			<input
				class="w-full rounded border border-border-default bg-background-muted px-2 py-1.5 text-[12px] text-foreground placeholder:text-foreground-subtle"
				type="text"
				bind:value={projectPath}
				placeholder="~/sandbox/pi-tdd"
			/>
			<button
				type="submit"
				class="w-full rounded bg-accent-blue px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-background transition-colors hover:brightness-110 disabled:opacity-40"
				disabled={!projectPath.trim() || $projectsBusy}
			>
				{$projectsBusy ? "Adding..." : "Add Project"}
			</button>
			<p class="text-[10px] text-foreground-muted">
				Pass a repo root to use <code>eval/</code> by convention, or point directly at an eval dir.
			</p>
		</form>
	{/if}

	{#if $projectsError}
		<p class="px-3 pb-3 text-xs text-accent-red">{$projectsError}</p>
	{/if}
</div>

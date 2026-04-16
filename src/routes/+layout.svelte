<script lang="ts">
	import "../app.css";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import { loadInitialData, resetRunData } from "../stores/runs.js";
	import { loadLauncherConfig, resetLauncherConfig } from "../stores/launcher.js";
	import { connectSSE, disconnectSSE } from "../stores/sse.js";
	import { activeProjectId, loadProjects } from "../stores/projects.js";
	import { resetSelection } from "../stores/selection.js";
	import { onMount } from "svelte";

	let { children } = $props();
	let loading = $state(true);
	let projectsReady = $state(false);

	onMount(() => {
		void loadProjects().finally(() => {
			projectsReady = true;
		});
		return () => disconnectSSE();
	});

	$effect(() => {
		if (!projectsReady) return;

		const projectId = $activeProjectId;
		let cancelled = false;

		resetSelection();
		resetRunData();
		resetLauncherConfig();
		disconnectSSE();

		if (!projectId) {
			loading = false;
			return;
		}

		loading = true;
		void Promise.all([loadInitialData(projectId), loadLauncherConfig(projectId)]).finally(() => {
			if (cancelled || projectId !== $activeProjectId) return;
			loading = false;
			connectSSE(projectId);
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="grid grid-cols-[340px_1fr] h-dvh">
	<Sidebar />
	<main class="overflow-y-auto p-6 text-[15px]">
		{#if loading}
			<div class="flex items-center justify-center h-full text-foreground-muted">
				Loading...
			</div>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>

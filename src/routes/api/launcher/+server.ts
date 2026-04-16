import { json } from "@sveltejs/kit";
import { getActiveProjectRuntime } from "$lib/server/runtime.js";
import { getRunStatus, spawnRun } from "$lib/server/launcher.js";
import type { RunRequest } from "$eval/types.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ url }) => {
	let runtime;
	try {
		runtime = await getActiveProjectRuntime();
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load project config";
		return json({ error: message }, { status: 500 });
	}
	if (!runtime) {
		return json({ error: "No active project" }, { status: 404 });
	}

	// GET /api/launcher?status — return run status
	if (url.searchParams.has("status")) {
		return json(getRunStatus(runtime.project.id));
	}

	// GET /api/launcher — return launcher config
	if (!runtime.launcherConfig) {
		return json({ error: "Launcher not configured" }, { status: 404 });
	}
	return json(runtime.launcherConfig);
};

export const POST: RequestHandler = async ({ request }) => {
	let runtime;
	try {
		runtime = await getActiveProjectRuntime();
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load project config";
		return json({ ok: false, error: message }, { status: 500 });
	}
	if (!runtime || !runtime.launcherConfig) {
		return json({ ok: false, error: "Launcher not configured" }, { status: 404 });
	}

	const body = (await request.json()) as RunRequest;
	const result = spawnRun(
		runtime.project.id,
		body,
		runtime.runCommand,
		runtime.runsDir,
		runtime.launcherConfig,
	);
	const status = result.ok ? 200 : 409;
	return json(result, { status });
};

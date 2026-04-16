import { json } from "@sveltejs/kit";
import { getRunStatus, spawnRun } from "$lib/server/launcher.js";
import { getProjectRuntime } from "$lib/server/runtime.js";
import type { RunRequest } from "$eval/types.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ params, url }) => {
	let runtime;
	try {
		runtime = await getProjectRuntime(params.projectId);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load project config";
		return json({ error: message }, { status: 500 });
	}
	if (!runtime) {
		return json({ error: "Project not found" }, { status: 404 });
	}

	if (url.searchParams.has("status")) {
		return json(getRunStatus(runtime.project.id));
	}

	if (!runtime.launcherConfig) {
		return json({ error: "Launcher not configured" }, { status: 404 });
	}

	return json(runtime.launcherConfig);
};

export const POST: RequestHandler = async ({ params, request }) => {
	let runtime;
	try {
		runtime = await getProjectRuntime(params.projectId);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load project config";
		return json({ ok: false, error: message }, { status: 500 });
	}
	if (!runtime) {
		return json({ ok: false, error: "Project not found" }, { status: 404 });
	}

	if (!runtime.launcherConfig) {
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
	return json(result, { status: result.ok ? 200 : 409 });
};

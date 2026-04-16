import { getActiveProject } from "$lib/server/projects.js";
import { projectWatchers } from "$lib/server/runtime.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = () => {
	const project = getActiveProject();
	if (!project) {
		return new Response("No active project", { status: 404 });
	}

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let unsubscribe: (() => void) | null = null;
			unsubscribe = projectWatchers.subscribe(project.id, (event) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
				} catch {
					unsubscribe?.();
				}
			});

			if (!unsubscribe) {
				controller.close();
				return;
			}

			// Clean up when client disconnects — the ReadableStream cancel callback
			// is the standard way to detect this
			return () => unsubscribe();
		},
		cancel() {
			// Client disconnected — cleanup handled by the unsubscribe in start()
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
};

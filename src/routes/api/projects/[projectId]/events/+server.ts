import { getRegisteredProject } from "$lib/server/projects.js";
import { projectWatchers } from "$lib/server/runtime.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = ({ params }) => {
	const project = getRegisteredProject(params.projectId);
	if (!project) {
		return new Response("Project not found", { status: 404 });
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

			return () => unsubscribe();
		},
		cancel() {
			// Cleanup handled by the unsubscribe returned from start().
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

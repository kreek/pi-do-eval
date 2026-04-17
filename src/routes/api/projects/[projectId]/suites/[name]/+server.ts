import { json } from "@sveltejs/kit";
import {
  deleteFileSuite,
  loadFileSuites,
  type SuiteDefinition,
  writeFileSuite,
} from "$eval/suite-files.js";
import { getRegisteredProject } from "$lib/server/projects.js";
import type { RequestHandler } from "./$types.js";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const project = getRegisteredProject(params.projectId);
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const body = (await request.json()) as Partial<SuiteDefinition>;
  const existing = loadFileSuites(project.evalDir).find((entry) => entry.name === params.name);
  if (!existing) {
    return json({ error: `Suite "${params.name}" is not file-backed or does not exist` }, { status: 404 });
  }

  const next: SuiteDefinition = {
    name: body.name ?? existing.name,
    ...(body.description !== undefined ? { description: body.description } : existing.description ? { description: existing.description } : {}),
    trials: Array.isArray(body.trials) ? body.trials : existing.trials,
    ...(body.regressionThreshold !== undefined
      ? { regressionThreshold: body.regressionThreshold }
      : existing.regressionThreshold !== undefined
        ? { regressionThreshold: existing.regressionThreshold }
        : {}),
  };

  try {
    // Rename case: delete old, write new
    if (next.name !== existing.name) {
      deleteFileSuite(project.evalDir, existing.name);
    }
    writeFileSuite(project.evalDir, next);
    return json({ suite: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write suite";
    return json({ error: message }, { status: 400 });
  }
};

export const DELETE: RequestHandler = ({ params }) => {
  const project = getRegisteredProject(params.projectId);
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const existing = loadFileSuites(project.evalDir).find((entry) => entry.name === params.name);
  if (!existing) {
    return json({ error: `Suite "${params.name}" is not file-backed or does not exist` }, { status: 404 });
  }

  try {
    deleteFileSuite(project.evalDir, existing.name);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete suite";
    return json({ error: message }, { status: 400 });
  }
};

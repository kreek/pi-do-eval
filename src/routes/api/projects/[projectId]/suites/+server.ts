import { json } from "@sveltejs/kit";
import { loadFileSuites, type SuiteDefinition, writeFileSuite } from "$eval/suite-files.js";
import { getRegisteredProject } from "$lib/server/projects.js";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = ({ params }) => {
  const project = getRegisteredProject(params.projectId);
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  return json({ suites: loadFileSuites(project.evalDir) });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const project = getRegisteredProject(params.projectId);
  if (!project) return json({ error: "Project not found" }, { status: 404 });

  const body = (await request.json()) as Partial<SuiteDefinition>;
  if (!body.name || !Array.isArray(body.trials)) {
    return json({ error: "Name and trials are required" }, { status: 400 });
  }

  const suite: SuiteDefinition = {
    name: body.name,
    ...(body.description ? { description: body.description } : {}),
    trials: body.trials,
    ...(body.regressionThreshold !== undefined
      ? { regressionThreshold: body.regressionThreshold }
      : {}),
  };

  const existing = loadFileSuites(project.evalDir).find((entry) => entry.name === suite.name);
  if (existing) {
    return json({ error: `Suite "${suite.name}" already exists` }, { status: 409 });
  }

  try {
    writeFileSuite(project.evalDir, suite);
    return json({ suite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write suite";
    return json({ error: message }, { status: 400 });
  }
};

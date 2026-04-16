import { spawn, type ChildProcess } from "node:child_process";
import type { LauncherConfig, RunRequest } from "$eval/types.js";

interface ActiveRun {
	id: string;
	projectId: string;
	process: ChildProcess;
	command: string;
	startedAt: string;
}

const activeRuns = new Map<string, ActiveRun>();

export function getRunStatus(projectId: string): { active: boolean; id?: string; command?: string } {
	const activeRun = activeRuns.get(projectId);
	if (!activeRun) return { active: false };
	return { active: true, id: activeRun.id, command: activeRun.command };
}

export function killActiveRun(projectId: string): void {
	const activeRun = activeRuns.get(projectId);
	if (activeRun) {
		activeRun.process.kill("SIGTERM");
		activeRuns.delete(projectId);
	}
}

function buildArgs(request: RunRequest): string[] {
	const args: string[] = [];

	if (request.type === "trial") {
		args.push("run", "--trial", request.trial ?? "", "--variant", request.variant ?? "");
	} else if (request.type === "suite") {
		args.push("run", request.suite ?? "");
	} else if (request.type === "bench") {
		args.push("bench", request.suite ?? "");
	}

	if (request.model) {
		args.push("--model", request.model);
	}
	if (request.noJudge) {
		args.push("--no-judge");
	}

	return args;
}

function validateRequest(request: RunRequest, config: LauncherConfig): string | null {
	if (request.type === "trial") {
		if (!request.trial || !request.variant) {
			return "Trial and variant are required";
		}
		const trial = config.trials.find((t) => t.name === request.trial);
		if (!trial) return `Unknown trial: ${request.trial}`;
		if (!trial.variants.includes(request.variant)) {
			return `Unknown variant "${request.variant}" for trial "${request.trial}"`;
		}
	} else {
		if (!request.suite) return "Suite name is required";
		if (!config.suites[request.suite]) {
			return `Unknown suite: ${request.suite}`;
		}
	}
	return null;
}

export function spawnRun(
	projectId: string,
	request: RunRequest,
	runCommand: string,
	cwd: string,
	config: LauncherConfig,
): { ok: true; id: string } | { ok: false; error: string } {
	const activeRun = activeRuns.get(projectId);
	if (activeRun) {
		return { ok: false, error: "A run is already active" };
	}

	const validationError = validateRequest(request, config);
	if (validationError) {
		return { ok: false, error: validationError };
	}

	const parts = runCommand.split(/\s+/);
	const cmd = parts[0]!;
	const baseArgs = parts.slice(1);
	const runArgs = buildArgs(request);
	const allArgs = [...baseArgs, ...runArgs];

	const id = `run-${Date.now()}`;
	const command = `${runCommand} ${runArgs.join(" ")}`;

	const child = spawn(cmd, allArgs, {
		cwd,
		stdio: ["ignore", "inherit", "inherit"],
		env: { ...process.env },
	});

	activeRuns.set(projectId, {
		id,
		projectId,
		process: child,
		command,
		startedAt: new Date().toISOString(),
	});

	child.on("exit", () => {
		if (activeRuns.get(projectId)?.id === id) {
			activeRuns.delete(projectId);
		}
	});

	child.on("error", (err) => {
		console.error(`Run process error: ${err.message}`);
		if (activeRuns.get(projectId)?.id === id) {
			activeRuns.delete(projectId);
		}
	});

	return { ok: true, id };
}

import type { LauncherConfig } from "$eval/types.js";

export interface LauncherSelectionState {
	selectedSuite: string;
	selectedTrial: string;
	selectedVariant: string;
}

export function normalizeLauncherSelection(
	config: LauncherConfig,
	current: LauncherSelectionState,
): LauncherSelectionState {
	const suiteNames = Object.keys(config.suites);
	const selectedSuite = suiteNames.includes(current.selectedSuite)
		? current.selectedSuite
		: (suiteNames[0] ?? "");

	const trial = config.trials.find((entry) => entry.name === current.selectedTrial) ?? config.trials[0];
	const selectedTrial = trial?.name ?? "";
	const selectedVariant = trial?.variants.includes(current.selectedVariant)
		? current.selectedVariant
		: (trial?.variants[0] ?? "");

	return {
		selectedSuite,
		selectedTrial,
		selectedVariant,
	};
}

<script lang="ts">
	import { shortModelName } from "$lib/utils.js";

	interface TrendComparisonSummary {
		hardRegressionCount: number;
		clearRegressionCount: number;
		driftCount: number;
	}

	interface TrendChartPoint {
		suiteRunId: string;
		axisLabel: string;
		tooltipLabel: string;
		averageOverall: number;
		totalRuns: number;
		hardFailures: number;
		delta: number | null;
		workerModel?: string;
		comparison?: TrendComparisonSummary | null;
	}

	interface TrialTrendLine {
		key: string;
		label: string;
		values: Array<number | null>;
	}

	let {
		points,
		trialTrends = [],
	}: {
		points: TrendChartPoint[];
		trialTrends?: TrialTrendLine[];
	} = $props();

	const WIDTH = 960;
	const HEIGHT = 320;
	const MARGIN_TOP = 18;
	const MARGIN_RIGHT = 18;
	const MARGIN_BOTTOM = 44;
	const MARGIN_LEFT = 44;
	const INNER_WIDTH = WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
	const INNER_HEIGHT = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
	const TOOLTIP_FLIP_THRESHOLD_Y = MARGIN_TOP + 112;
	const TRIAL_COLORS = [
		"var(--color-accent-green)",
		"var(--color-accent-orange)",
		"var(--color-accent-purple)",
		"#8bd3ff",
		"#f8ca7e",
		"#b6e56c",
		"#f6a6be",
		"#dac0ff",
	];

	let showTrialLines = $state(false);
	let hoveredSuiteRunId = $state<string | null>(null);

	let allValues = $derived.by(() => {
		const values = points.map((point) => point.averageOverall);
		for (const trend of trialTrends) {
			for (const value of trend.values) {
				if (typeof value === "number") {
					values.push(value);
				}
			}
		}
		return values;
	});

	let yDomain = $derived.by(() => {
		if (allValues.length === 0) return { min: 0, max: 100 };
		const minValue = Math.min(...allValues);
		const maxValue = Math.max(...allValues);
		const paddedMin = Math.max(0, Math.floor((minValue - 5) / 5) * 5);
		const paddedMax = Math.min(100, Math.ceil((maxValue + 5) / 5) * 5);
		if (paddedMax === paddedMin) {
			return { min: Math.max(0, paddedMin - 5), max: Math.min(100, paddedMax + 5) };
		}
		return { min: paddedMin, max: paddedMax };
	});

	function xFor(index: number): number {
		if (points.length <= 1) return MARGIN_LEFT + INNER_WIDTH / 2;
		return MARGIN_LEFT + (INNER_WIDTH * index) / (points.length - 1);
	}

	function yFor(value: number): number {
		const { min, max } = yDomain;
		const range = Math.max(1, max - min);
		return MARGIN_TOP + INNER_HEIGHT - ((value - min) / range) * INNER_HEIGHT;
	}

	let plottedPoints = $derived.by(() =>
		points.map((point, index) => ({
			...point,
			x: xFor(index),
			y: yFor(point.averageOverall),
		})),
	);

	let averageLinePath = $derived(pathFor(plottedPoints.map((point) => ({ x: point.x, y: point.y }))));

	let averageAreaPath = $derived.by(() => {
		if (plottedPoints.length === 0) return "";
		const first = plottedPoints[0];
		const last = plottedPoints[plottedPoints.length - 1];
		if (!first || !last) return "";
		return `${averageLinePath} L ${last.x} ${MARGIN_TOP + INNER_HEIGHT} L ${first.x} ${MARGIN_TOP + INNER_HEIGHT} Z`;
	});

	let plottedTrialTrends = $derived.by(() =>
		trialTrends.map((trend, index) => ({
			...trend,
			color: TRIAL_COLORS[index % TRIAL_COLORS.length],
			path: pathFor(
				trend.values.map((value, pointIndex) =>
					typeof value === "number"
						? {
								x: xFor(pointIndex),
								y: yFor(value),
							}
						: null,
				),
			),
		})),
	);

	let yTicks = $derived.by(() => {
		const { min, max } = yDomain;
		const count = 5;
		return Array.from({ length: count }, (_, index) => {
			const value = min + ((max - min) * index) / (count - 1);
			return {
				value: Math.round(value),
				y: yFor(value),
			};
		}).reverse();
	});

	let xTicks = $derived.by(() => {
		if (plottedPoints.length <= 1) return plottedPoints;
		const step = Math.max(1, Math.ceil(plottedPoints.length / 6));
		return plottedPoints.filter((point, index) => index === 0 || index === plottedPoints.length - 1 || index % step === 0);
	});

	let hoverPoint = $derived.by(() => {
		if (plottedPoints.length === 0) return null;
		return plottedPoints.find((point) => point.suiteRunId === hoveredSuiteRunId) ?? plottedPoints[plottedPoints.length - 1];
	});

	let hoverTooltipPlacement = $derived.by(() => {
		if (!hoverPoint) return "above" as const;
		return hoverPoint.y <= TOOLTIP_FLIP_THRESHOLD_Y ? ("below" as const) : ("above" as const);
	});

	let trendSummary = $derived.by(() => {
		let improved = 0;
		let regressed = 0;
		let hard = 0;
		let drift = 0;
		for (const point of points) {
			if ((point.delta ?? 0) > 0) improved += 1;
			if ((point.delta ?? 0) < 0) regressed += 1;
			hard += point.comparison?.hardRegressionCount ?? 0;
			drift += (point.comparison?.clearRegressionCount ?? 0) + (point.comparison?.driftCount ?? 0);
		}
		return { improved, regressed, hard, drift };
	});

	function pathFor(points: Array<{ x: number; y: number } | null>): string {
		let path = "";
		let started = false;
		for (const point of points) {
			if (!point) {
				started = false;
				continue;
			}
			path += `${started ? " L" : "M"} ${point.x} ${point.y}`;
			started = true;
		}
		return path;
	}

	function pointStroke(point: TrendChartPoint): string {
		if ((point.comparison?.hardRegressionCount ?? 0) > 0) return "var(--color-accent-red)";
		if (((point.comparison?.clearRegressionCount ?? 0) + (point.comparison?.driftCount ?? 0)) > 0) {
			return "var(--color-accent-orange)";
		}
		if ((point.delta ?? 0) > 0) return "var(--color-accent-green)";
		if ((point.delta ?? 0) < 0) return "var(--color-accent-red)";
		return "var(--color-accent-blue)";
	}

	function deltaLabel(delta: number | null): string {
		if (delta == null) return "Baseline";
		if (delta === 0) return "Flat";
		return delta > 0 ? `+${delta}` : `${delta}`;
	}

	function comparisonSummary(point: TrendChartPoint): string | null {
		if (!point.comparison) return null;
		const parts: string[] = [];
		if (point.comparison.hardRegressionCount > 0) {
			parts.push(`${point.comparison.hardRegressionCount} hard`);
		}
		if (point.comparison.clearRegressionCount > 0) {
			parts.push(`${point.comparison.clearRegressionCount} clear`);
		}
		if (point.comparison.driftCount > 0) {
			parts.push(`${point.comparison.driftCount} drift`);
		}
		return parts.length > 0 ? parts.join(", ") : null;
	}

	function tooltipLeftPercent(x: number): number {
		return Math.max(10, Math.min(90, (x / WIDTH) * 100));
	}

	function tooltipTopPercent(y: number, placement: "above" | "below"): number {
		const yPercent = (y / HEIGHT) * 100;
		if (placement === "below") {
			return Math.max(8, Math.min(72, yPercent + 3));
		}
		return Math.max(22, Math.min(84, yPercent - 4));
	}

	function tooltipTransform(placement: "above" | "below"): string {
		return placement === "below"
			? "translate(-50%, 0.65rem)"
			: "translate(-50%, calc(-100% - 0.5rem))";
	}
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-foreground-subtle">
			<span class="inline-flex items-center gap-2 rounded-full border border-border-muted bg-background-muted px-2.5 py-1">
				<span class="h-2.5 w-2.5 rounded-full bg-accent-blue"></span>
				Average
			</span>
			<span class="inline-flex items-center gap-2 rounded-full border border-border-muted bg-background-muted px-2.5 py-1">
				<span class="h-2.5 w-2.5 rounded-full bg-accent-green"></span>
				Improved
			</span>
			<span class="inline-flex items-center gap-2 rounded-full border border-border-muted bg-background-muted px-2.5 py-1">
				<span class="h-2.5 w-2.5 rounded-full bg-accent-red"></span>
				Regression
			</span>
			<span class="inline-flex items-center gap-2 rounded-full border border-border-muted bg-background-muted px-2.5 py-1">
				<span class="h-2.5 w-2.5 rounded-full bg-accent-orange"></span>
				Drift / Clear
			</span>
			{#if trialTrends.length > 0}
				<button
					type="button"
					class="rounded-full border border-border-muted px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-foreground-subtle transition-colors hover:border-border-default hover:text-foreground"
					onclick={() => (showTrialLines = !showTrialLines)}
				>
					{showTrialLines ? "Hide trial lines" : `Show ${trialTrends.length} trial lines`}
				</button>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-foreground-subtle">
			<span class="rounded-full border border-border-muted bg-background-muted px-2.5 py-1">{points.length} runs</span>
			<span class="rounded-full border border-border-muted bg-background-muted px-2.5 py-1">
				{trendSummary.improved} up
			</span>
			<span class="rounded-full border border-border-muted bg-background-muted px-2.5 py-1">
				{trendSummary.regressed} down
			</span>
				{#if trendSummary.hard > 0}
					<span class="rounded-full border border-border-muted bg-background-muted px-2.5 py-1 text-accent-red">
						{trendSummary.hard} hard
					</span>
				{/if}
				{#if trendSummary.drift > 0}
					<span class="rounded-full border border-border-muted bg-background-muted px-2.5 py-1 text-accent-orange">
						{trendSummary.drift} drift
					</span>
				{/if}
			</div>
		</div>

	<div class="relative overflow-hidden rounded-xl border border-border-muted bg-[linear-gradient(180deg,var(--color-background-muted),var(--color-background-subtle))]">
		<div class="h-[320px] w-full">
			<svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} class="h-full w-full">
				<defs>
					<linearGradient id="suite-trend-fill" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stop-color="var(--color-accent-blue)" stop-opacity="0.22"></stop>
						<stop offset="100%" stop-color="var(--color-accent-blue)" stop-opacity="0.02"></stop>
					</linearGradient>
				</defs>

				{#each yTicks as tick}
					<line
						x1={MARGIN_LEFT}
						x2={WIDTH - MARGIN_RIGHT}
						y1={tick.y}
						y2={tick.y}
						stroke="var(--color-border-muted)"
						stroke-dasharray="4 8"
					></line>
					<text
						x={MARGIN_LEFT - 10}
						y={tick.y + 4}
						text-anchor="end"
						font-size="11"
						fill="var(--color-foreground-subtle)"
					>
						{tick.value}
					</text>
				{/each}

				<line
					x1={MARGIN_LEFT}
					x2={WIDTH - MARGIN_RIGHT}
					y1={MARGIN_TOP + INNER_HEIGHT}
					y2={MARGIN_TOP + INNER_HEIGHT}
					stroke="var(--color-border-default)"
				></line>

				{#if showTrialLines}
					{#each plottedTrialTrends as trend (trend.key)}
						{#if trend.path}
							<path
								d={trend.path}
								fill="none"
								stroke={trend.color}
								stroke-width="1.6"
								stroke-dasharray="6 5"
								stroke-linecap="round"
								opacity="0.55"
							></path>
						{/if}
					{/each}
				{/if}

				{#if averageAreaPath}
					<path d={averageAreaPath} fill="url(#suite-trend-fill)"></path>
				{/if}
				{#if averageLinePath}
					<path
						d={averageLinePath}
						fill="none"
						stroke="var(--color-accent-blue)"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					></path>
				{/if}

				{#each plottedPoints as point (point.suiteRunId)}
					<circle cx={point.x} cy={point.y} r="8" fill={pointStroke(point)} opacity="0.18" pointer-events="none"></circle>
					<circle
						cx={point.x}
						cy={point.y}
						r="4.5"
						fill="var(--color-background)"
						stroke={pointStroke(point)}
						stroke-width="2.5"
						role="presentation"
						aria-hidden="true"
						onpointerenter={() => (hoveredSuiteRunId = point.suiteRunId)}
					>
						<title>
							{point.tooltipLabel}: {point.averageOverall} ({deltaLabel(point.delta)})
						</title>
					</circle>
				{/each}

				{#each xTicks as tick (tick.suiteRunId)}
					<text
						x={tick.x}
						y={HEIGHT - 12}
						text-anchor="middle"
						font-size="11"
						fill="var(--color-foreground-subtle)"
					>
						{tick.axisLabel}
					</text>
				{/each}
			</svg>
		</div>

			{#if hoverPoint}
				<div
					class="pointer-events-none absolute min-w-[14rem] max-w-[18rem] rounded-lg border border-border-default bg-background px-3 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.28)]"
					style={`left:${tooltipLeftPercent(hoverPoint.x)}%; top:${tooltipTopPercent(hoverPoint.y, hoverTooltipPlacement)}%; transform:${tooltipTransform(hoverTooltipPlacement)};`}
				>
				<div class="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-foreground-subtle">
					<span>{hoverPoint.tooltipLabel}</span>
					<span style={`color:${pointStroke(hoverPoint)}`}>{deltaLabel(hoverPoint.delta)}</span>
				</div>
				<div class="mt-1 flex items-baseline gap-2">
					<span class="text-2xl font-bold text-foreground">{hoverPoint.averageOverall}</span>
					<span class="text-xs uppercase tracking-[0.16em] text-foreground-subtle">Average score</span>
				</div>
				<div class="mt-2 flex flex-wrap gap-2 text-xs text-foreground-muted">
					<span>{hoverPoint.totalRuns} trials</span>
					{#if hoverPoint.hardFailures > 0}
						<span class="text-accent-red">{hoverPoint.hardFailures} hard failures</span>
					{/if}
					{#if hoverPoint.workerModel}
						<span>{shortModelName(hoverPoint.workerModel)}</span>
					{/if}
				</div>
				{#if comparisonSummary(hoverPoint)}
					<div class="mt-2 text-xs text-foreground-muted">
						Regression analysis: {comparisonSummary(hoverPoint)}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

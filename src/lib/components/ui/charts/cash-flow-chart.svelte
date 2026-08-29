<script lang="ts">
	export interface ChartData {
		month: number;
		year: number;
		income: number;
		expense: number;
	}

	type Props = {
		data: ChartData[];
		height?: number;
		class?: string;
	};

	let { data, height = 250, class: className = '' }: Props = $props();

	const WIDTH = 640;
	const MARGIN = { top: 12, right: 12, bottom: 34, left: 58 };
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'Mei',
		'Jun',
		'Jul',
		'Agu',
		'Sep',
		'Okt',
		'Nov',
		'Des'
	];
	const compactNumber = new Intl.NumberFormat('id-ID', {
		notation: 'compact',
		maximumFractionDigits: 1
	});
	const fullNumber = new Intl.NumberFormat('id-ID');

	let chartData = $derived(
		(data ?? []).map((item) => ({
			label: item.month >= 1 && item.month <= 12 ? MONTHS[item.month - 1] : '?',
			year: item.year,
			income: Math.max(0, item.income),
			expense: Math.max(0, item.expense)
		}))
	);
	let chartHeight = $derived(Math.max(height - 28, 120));
	let plotWidth = $derived(WIDTH - MARGIN.left - MARGIN.right);
	let plotHeight = $derived(chartHeight - MARGIN.top - MARGIN.bottom);
	let maxValue = $derived.by(() => {
		const maximum = Math.max(0, ...chartData.flatMap((item) => [item.income, item.expense]));
		if (maximum === 0) return 1;
		const magnitude = 10 ** Math.floor(Math.log10(maximum));
		return Math.ceil(maximum / magnitude) * magnitude;
	});
	let ticks = $derived(Array.from({ length: 5 }, (_, index) => (maxValue * index) / 4));
	let groupWidth = $derived(chartData.length > 0 ? plotWidth / chartData.length : plotWidth);
	let barWidth = $derived(Math.max(4, Math.min(26, (groupWidth - 12) / 2)));

	function yPosition(value: number): number {
		return MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
	}

	function barX(index: number, seriesIndex: number): number {
		const groupStart = MARGIN.left + index * groupWidth;
		const barsWidth = barWidth * 2 + 4;
		return groupStart + (groupWidth - barsWidth) / 2 + seriesIndex * (barWidth + 4);
	}

	function formatAxisValue(value: number): string {
		return value === 0 ? '0' : compactNumber.format(value);
	}
</script>

<div class="w-full {className}" style:height="{height}px">
	<div class="mb-1 flex h-6 items-center justify-end gap-4 text-xs text-muted-foreground">
		<span class="inline-flex items-center gap-1.5">
			<span class="h-2.5 w-2.5 rounded-sm bg-green-500"></span>
			Pemasukan
		</span>
		<span class="inline-flex items-center gap-1.5">
			<span class="h-2.5 w-2.5 rounded-sm bg-red-500"></span>
			Pengeluaran
		</span>
	</div>

	<svg
		class="block h-auto w-full"
		viewBox="0 0 {WIDTH} {chartHeight}"
		style:height="{chartHeight}px"
		preserveAspectRatio="none"
		role="img"
		aria-label="Grafik pemasukan dan pengeluaran enam bulan terakhir"
	>
		{#each ticks as tick (tick)}
			{@const y = yPosition(tick)}
			<line
				x1={MARGIN.left}
				x2={WIDTH - MARGIN.right}
				y1={y}
				y2={y}
				class="stroke-border"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
			<text
				x={MARGIN.left - 8}
				y={y + 4}
				text-anchor="end"
				class="fill-muted-foreground text-[11px]"
			>
				{formatAxisValue(tick)}
			</text>
		{/each}

		{#each chartData as item, index (`${item.year}-${item.label}`)}
			{@const incomeY = yPosition(item.income)}
			{@const expenseY = yPosition(item.expense)}
			<rect
				x={barX(index, 0)}
				y={incomeY}
				width={barWidth}
				height={Math.max(0, MARGIN.top + plotHeight - incomeY)}
				rx="2"
				class="fill-green-500"
			>
				<title>{item.label} {item.year}: Pemasukan Rp {fullNumber.format(item.income)}</title>
			</rect>
			<rect
				x={barX(index, 1)}
				y={expenseY}
				width={barWidth}
				height={Math.max(0, MARGIN.top + plotHeight - expenseY)}
				rx="2"
				class="fill-red-500"
			>
				<title>{item.label} {item.year}: Pengeluaran Rp {fullNumber.format(item.expense)}</title>
			</rect>
			<text
				x={MARGIN.left + index * groupWidth + groupWidth / 2}
				y={chartHeight - 10}
				text-anchor="middle"
				class="fill-muted-foreground text-[11px]"
			>
				{item.label}
			</text>
		{/each}
	</svg>

	<div class="sr-only">
		{#each chartData as item (`summary-${item.year}-${item.label}`)}
			<p>
				{item.label}
				{item.year}: pemasukan Rp {fullNumber.format(item.income)}, pengeluaran Rp
				{fullNumber.format(item.expense)}.
			</p>
		{/each}
	</div>
</div>

<script lang="ts">
	import { cn } from '$lib/utils';
	import { BarChart, Chart, Svg, Axis, Grid, Legend } from 'layerchart';

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

	let { data, height = 250, class: className }: Props = $props();

	// Constants to avoid recreation on each render
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
	const SERIES = [
		{ key: 'income', label: 'Pemasukan', color: '#22c55e' },
		{ key: 'expense', label: 'Pengeluaran', color: '#ef4444' }
	];

	// Transform data for grouped bar chart (with defensive handling)
	let chartData = $derived(
		(data || []).map((d) => ({
			month: d.month >= 1 && d.month <= 12 ? MONTHS[d.month - 1] : '?',
			income: d.income,
			expense: d.expense
		}))
	);
</script>

<div class={cn('w-full', className)} style="height: {height}px">
	<BarChart
		data={chartData}
		x="month"
		y="value"
		series={SERIES}
		padding={{ top: 20, right: 20, bottom: 30, left: 50 }}
		bandPadding={0.2}
		groupPadding={0.1}
	>
		<Chart>
			<Grid />
			<Svg>
				<Axis axis="x" placement="bottom" />
				<Axis axis="y" placement="left" />
			</Svg>
			<Legend />
		</Chart>
	</BarChart>
</div>

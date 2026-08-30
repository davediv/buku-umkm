import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CashFlowChart from './cash-flow-chart.svelte';

describe('CashFlowChart', () => {
	it('renders an accessible pair of bars for every month', async () => {
		render(CashFlowChart, {
			data: [
				{ month: 7, year: 2026, income: 5_000_000, expense: 3_000_000 },
				{ month: 8, year: 2026, income: 7_500_000, expense: 4_000_000 }
			]
		});

		await expect
			.element(
				page.getByRole('img', {
					name: 'Grafik pemasukan dan pengeluaran enam bulan terakhir'
				})
			)
			.toBeInTheDocument();
		expect(document.querySelectorAll('rect')).toHaveLength(4);
		await expect
			.element(page.getByText(/Jul\s+2026:\s+pemasukan Rp 5\.000\.000/))
			.toBeInTheDocument();
	});
});

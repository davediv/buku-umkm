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
					name: 'Grafik kas masuk dan kas keluar enam bulan terakhir'
				})
			)
			.toBeInTheDocument();
		expect(document.querySelectorAll('rect')).toHaveLength(4);
		await expect
			.element(page.getByText(/Jul\s+2026:\s+kas masuk Rp 5\.000\.000/))
			.toBeInTheDocument();
	});

	it('names each bar with a readable month and year', async () => {
		render(CashFlowChart, {
			data: [{ month: 7, year: 2026, income: 5_000_000, expense: 3_000_000 }]
		});

		const titles = [...document.querySelectorAll('rect title')].map((title) => title.textContent);
		expect(titles).toEqual([
			'Jul 2026: Kas masuk Rp 5.000.000',
			'Jul 2026: Kas keluar Rp 3.000.000'
		]);
	});

	it('keeps the axis on whole Rupiah and draws only 0 when nothing moved', async () => {
		const small = render(CashFlowChart, {
			data: [{ month: 7, year: 2026, income: 5, expense: 0 }]
		});
		const smallTicks = [...document.querySelectorAll('svg text')]
			.map((text) => text.textContent?.trim())
			.filter((text) => text && /^\d/.test(text));
		expect(smallTicks).toEqual(['0', '2', '4', '6', '8']);
		small.unmount();

		render(CashFlowChart, { data: [{ month: 7, year: 2026, income: 0, expense: 0 }] });
		const emptyTicks = [...document.querySelectorAll('svg text')]
			.map((text) => text.textContent?.trim())
			.filter((text) => text && /^\d/.test(text));
		expect(emptyTicks).toEqual(['0']);
	});
});

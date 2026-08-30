import { describe, expect, it } from 'vitest';
import {
	getIncomeExpenseViewHref,
	resolveDashboardPeriod,
	resolveIncomeExpenseView
} from './view-state';

describe('URL-backed view state', () => {
	it('resolves category and template views safely', () => {
		expect(resolveIncomeExpenseView('expense')).toBe('expense');
		expect(resolveIncomeExpenseView('unknown')).toBe('income');
		expect(resolveIncomeExpenseView(null)).toBe('income');
	});

	it('uses a validated dashboard period as the view state', () => {
		expect(resolveDashboardPeriod('daily')).toBe('daily');
		expect(resolveDashboardPeriod('weekly')).toBe('weekly');
		expect(resolveDashboardPeriod('quarterly')).toBe('monthly');
		expect(resolveDashboardPeriod(null)).toBe('monthly');
	});

	it('changes the view without losing return context', () => {
		expect(
			getIncomeExpenseViewHref(
				'/kategori',
				new URLSearchParams('return_to=%2Ftransaksi%2Ftambah&type=income'),
				'expense'
			)
		).toBe('/kategori?return_to=%2Ftransaksi%2Ftambah&type=expense');
	});
});

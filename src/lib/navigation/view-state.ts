export type IncomeExpenseView = 'income' | 'expense';
export type DashboardPeriod = 'daily' | 'weekly' | 'monthly';

export function resolveDashboardPeriod(value: string | null): DashboardPeriod {
	return value === 'daily' || value === 'weekly' ? value : 'monthly';
}

export function resolveIncomeExpenseView(value: string | null): IncomeExpenseView {
	return value === 'expense' ? 'expense' : 'income';
}

export function getIncomeExpenseViewHref(
	pathname: '/kategori' | '/pengaturan/template',
	searchParams: URLSearchParams,
	type: IncomeExpenseView
): string {
	const next = new URLSearchParams(searchParams);
	next.set('type', type);
	return `${pathname}?${next.toString()}`;
}

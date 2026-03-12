import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { dashboardQueries, chartOfAccountQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse period parameter (default: monthly)
	const periodParam = url.searchParams.get('period');
	const period = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(periodParam ?? '')
		? periodParam
		: 'monthly';

	try {
		// Run all queries in parallel for performance
		// Note: getPreviousPeriodStats returns both current and previous period data,
		// so we use current from it instead of making a separate getPeriodStats call
		const [categoryBreakdown, previousPeriod, accounts] = await Promise.all([
			dashboardQueries.getProfitLossByCategory(
				db,
				userId,
				period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
			),
			dashboardQueries.getPreviousPeriodStats(
				db,
				userId,
				period as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
			),
			chartOfAccountQueries.findAll(db, userId)
		]);

		// Use current period data from getPreviousPeriodStats
		const currentPeriod = previousPeriod.current;
		const previousPeriodData = previousPeriod.previous;

		// Calculate total balance across all accounts
		const totalBalance = accounts
			.filter((acc) => acc.type === 'asset')
			.reduce((sum, acc) => sum + acc.balance, 0);

		// Calculate percentage change
		const calculatePercentChange = (current: number, previous: number): number => {
			if (previous === 0) return current > 0 ? 100 : 0;
			return ((current - previous) / previous) * 100;
		};

		const incomeChange = calculatePercentChange(currentPeriod.income, previousPeriodData.income);
		const expenseChange = calculatePercentChange(currentPeriod.expense, previousPeriodData.expense);
		const profitChange = calculatePercentChange(currentPeriod.profit, previousPeriodData.profit);

		// Calculate total income and expense for percentage calculations
		const totalIncome = categoryBreakdown.income.reduce((sum, c) => sum + c.total, 0);
		const totalExpense = categoryBreakdown.expense.reduce((sum, c) => sum + c.total, 0);

		// Add percentage to category data
		const incomeWithPercent = categoryBreakdown.income.map((c) => ({
			...c,
			percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0
		}));
		const expenseWithPercent = categoryBreakdown.expense.map((c) => ({
			...c,
			percentage: totalExpense > 0 ? (c.total / totalExpense) * 100 : 0
		}));

		// Format period label
		const getPeriodLabel = (p: string) => {
			const now = new Date();
			const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

			const labels: Record<string, string> = {
				daily: 'Hari Ini',
				weekly: 'Minggu Ini',
				monthly: 'Bulan Ini',
				quarterly: `Q${currentQuarter} ${now.getFullYear()}`,
				yearly: 'Tahun Ini'
			};
			return labels[p] || 'Bulan Ini';
		};

		// Calculate start/end dates based on period
		const now = new Date();
		let startDate: string;
		let endDate: string;
		if (period === 'daily') {
			startDate = now.toISOString().split('T')[0];
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			endDate = tomorrow.toISOString().split('T')[0];
		} else if (period === 'weekly') {
			const dayOfWeek = now.getDay();
			const monday = new Date(now);
			monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
			startDate = monday.toISOString().split('T')[0];
			const sunday = new Date(monday);
			sunday.setDate(sunday.getDate() + 6);
			endDate = sunday.toISOString().split('T')[0];
		} else if (period === 'monthly') {
			startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
			endDate =
				now.getMonth() === 11
					? `${now.getFullYear() + 1}-01-01`
					: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;
		} else if (period === 'quarterly') {
			// Calculate current quarter
			const currentQuarter = Math.floor(now.getMonth() / 3);
			const quarterStartMonth = currentQuarter * 3 + 1;
			const quarterEndMonth = quarterStartMonth + 3;
			startDate = `${now.getFullYear()}-${String(quarterStartMonth).padStart(2, '0')}-01`;
			endDate =
				quarterEndMonth > 12
					? `${now.getFullYear() + 1}-01-01`
					: `${now.getFullYear()}-${String(quarterEndMonth).padStart(2, '0')}-01`;
		} else {
			startDate = `${now.getFullYear()}-01-01`;
			endDate = `${now.getFullYear() + 1}-01-01`;
		}

		return {
			profitLoss: {
				period,
				periodLabel: getPeriodLabel(period!),
				startDate,
				endDate,
				income: currentPeriod.income,
				expense: currentPeriod.expense,
				profit: currentPeriod.profit,
				totalBalance,
				comparison: {
					income: {
						change: incomeChange,
						previousValue: previousPeriodData.income
					},
					expense: {
						change: expenseChange,
						previousValue: previousPeriodData.expense
					},
					profit: {
						change: profitChange,
						previousValue: previousPeriodData.profit
					}
				},
				categoryBreakdown: {
					income: incomeWithPercent,
					expense: expenseWithPercent
				}
			}
		};
	} catch (error) {
		console.error('Error fetching profit/loss data:', error);
		return {
			profitLoss: null,
			error: 'Gagal memuat data laporan laba/rugi'
		};
	}
};

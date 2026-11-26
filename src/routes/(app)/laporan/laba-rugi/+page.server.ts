import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { dashboardQueries, chartOfAccountQueries } from '$lib/server/db/queries';
import { reportPeriodRanges, type ReportPeriod } from '$lib/server/db/queries/ledger';
import { describeReportPeriod } from '$lib/server/reports/period-label';
import { todayInJakarta } from '$lib/shared/dates';
import { redirect } from '@sveltejs/kit';
import { summarizeError } from '$lib/server/error-summary';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse period parameter (default: monthly)
	const periodParam = url.searchParams.get('period');
	const period: ReportPeriod = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(
		periodParam ?? ''
	)
		? (periodParam as ReportPeriod)
		: 'monthly';
	// One "today" for every number on the page, so they all describe the same period.
	const today = todayInJakarta();

	try {
		// Run all queries in parallel for performance
		// Note: getPreviousPeriodStats returns both current and previous period data,
		// so we use current from it instead of making a separate getPeriodStats call
		const [categoryBreakdown, previousPeriod, accounts] = await Promise.all([
			dashboardQueries.getProfitLossByCategory(db, userId, period, today),
			dashboardQueries.getPreviousPeriodStats(db, userId, period, today),
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

		const { start: startDate, end: endDate } = reportPeriodRanges(period, today).current;

		return {
			profitLoss: {
				period,
				periodLabel: describeReportPeriod(period, { start: startDate, end: endDate }),
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
	} catch (cause) {
		console.error('Error fetching profit/loss data:', summarizeError(cause));
		return {
			profitLoss: null,
			error: 'Gagal memuat data laporan laba/rugi'
		};
	}
};

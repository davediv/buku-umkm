import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import {
	dashboardQueries,
	transactionQueries,
	chartOfAccountQueries
} from '$lib/server/db/queries';

type PeriodParam = 'daily' | 'weekly' | 'monthly';

// GET /api/dashboard - Returns aggregated dashboard data
export const GET: RequestHandler = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse period parameter (default: monthly)
	const periodParam = url.searchParams.get('period') as PeriodParam | null;
	const period: PeriodParam = ['daily', 'weekly', 'monthly'].includes(periodParam ?? '')
		? (periodParam as PeriodParam)
		: 'monthly';

	try {
		// Run all queries in parallel for performance
		// Note: When period is 'daily', periodStats already contains today's data
		const [summary, periodStats, debtSummary, recentTransactions, accounts, todayStatsResult] =
			await Promise.all([
				dashboardQueries.getSummary(db, userId),
				dashboardQueries.getPeriodStats(db, userId, period),
				dashboardQueries.getDebtSummary(db, userId),
				transactionQueries.getRecent(db, userId, 5),
				chartOfAccountQueries.findAll(db, userId),
				dashboardQueries.getTodayStats(db, userId)
			]);

		// Use periodStats when period is daily, otherwise use today's stats
		const today = period === 'daily' ? periodStats : todayStatsResult;

		// Calculate total balance across all accounts
		const totalBalance = accounts
			.filter((acc) => acc.type === 'asset')
			.reduce((sum, acc) => sum + acc.balance, 0);

		// Map recent transactions to simplified format
		const recent = recentTransactions.map((t) => ({
			id: t.id,
			date: t.date,
			type: t.type,
			amount: t.amount,
			description: t.description,
			accountName: t.account?.name ?? '',
			categoryName: t.category?.name ?? null
		}));

		// Calculate PPh Final 0.5% tax from monthly income (already in summary)
		const currentMonthTax = Math.floor(summary.monthlyIncome * 0.005);

		return json({
			data: {
				// Total balance across all accounts
				totalBalance,
				// Today's stats
				today: {
					income: today.income,
					expense: today.expense,
					profit: today.profit
				},
				// Selected period stats
				period: {
					type: periodStats.period,
					income: periodStats.income,
					expense: periodStats.expense,
					profit: periodStats.profit
				},
				// Cumulative annual revenue (for tax threshold)
				annualRevenue: summary.yearToDateRevenue,
				// Current month tax amount (PPh Final 0.5%)
				currentMonthTax,
				currentMonthRevenue: summary.monthlyIncome,
				// Outstanding debts
				debts: {
					piutang: debtSummary.piutang,
					hutang: debtSummary.hutang,
					total: debtSummary.piutang + debtSummary.hutang
				},
				// Recent transactions
				recentTransactions: recent,
				// Additional summary data
				summary: {
					netWorth: summary.netWorth,
					monthlyIncome: summary.monthlyIncome,
					monthlyExpense: summary.monthlyExpense,
					monthlyProfit: summary.monthlyProfit
				}
			}
		});
	} catch {
		console.error('Error fetching dashboard data:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

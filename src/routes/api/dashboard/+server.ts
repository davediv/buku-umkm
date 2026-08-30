import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { dashboardQueries, transactionQueries } from '$lib/server/db/queries';
import { getTaxDashboardEstimate } from '$lib/tax/service';

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
		const [overview, recentTransactions, taxEstimate] = await Promise.all([
			dashboardQueries.getOverview(db, userId, period),
			transactionQueries.getRecent(db, userId, 5),
			getTaxDashboardEstimate(db, userId)
		]);
		const { summary, periodStats, debtSummary, todayStats } = overview;

		// Use periodStats when period is daily, otherwise use today's stats
		const today = period === 'daily' ? periodStats : todayStats;

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

		return json({
			data: {
				// Total balance across all asset accounts
				totalBalance: summary.totalAssets,
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
				taxEstimate,
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

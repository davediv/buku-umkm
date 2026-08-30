import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { dashboardQueries, transactionQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';
import { getTaxDashboardEstimate } from '$lib/tax/service';
import { resolveDashboardPeriod } from '$lib/navigation/view-state';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse period parameter (default: monthly)
	const period = resolveDashboardPeriod(url.searchParams.get('period'));

	try {
		// Run all queries in parallel for performance
		const [overview, recentTransactions, cashFlow, taxEstimate] = await Promise.all([
			dashboardQueries.getOverview(db, userId, period),
			transactionQueries.getRecent(db, userId, 5),
			dashboardQueries.getCashFlow(db, userId, 6),
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

		return {
			dashboard: {
				totalBalance: summary.totalAssets,
				today: {
					income: today.income,
					expense: today.expense,
					profit: today.profit
				},
				period: {
					type: periodStats.period,
					income: periodStats.income,
					expense: periodStats.expense,
					profit: periodStats.profit
				},
				taxEstimate,
				debts: {
					piutang: debtSummary.piutang,
					hutang: debtSummary.hutang,
					total: debtSummary.piutang + debtSummary.hutang
				},
				recentTransactions: recent,
				chartData: cashFlow,
				summary: {
					netWorth: summary.netWorth,
					monthlyIncome: summary.monthlyIncome,
					monthlyExpense: summary.monthlyExpense,
					monthlyProfit: summary.monthlyProfit
				}
			}
		};
	} catch {
		console.error('Error fetching dashboard data:');
		return {
			dashboard: null,
			error: 'Gagal memuat data dashboard'
		};
	}
};

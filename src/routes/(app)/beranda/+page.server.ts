import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	dashboardQueries,
	transactionQueries,
	chartOfAccountQueries
} from '$lib/server/db/queries';
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
	const period = ['daily', 'weekly', 'monthly'].includes(periodParam ?? '')
		? periodParam
		: 'monthly';

	try {
		// Run all queries in parallel for performance
		const [
			summary,
			periodStats,
			debtSummary,
			recentTransactions,
			accounts,
			todayStatsResult,
			cashFlow
		] = await Promise.all([
			dashboardQueries.getSummary(db, userId),
			dashboardQueries.getPeriodStats(db, userId, period as 'daily' | 'weekly' | 'monthly'),
			dashboardQueries.getDebtSummary(db, userId),
			transactionQueries.getRecent(db, userId, 5),
			chartOfAccountQueries.findAll(db, userId),
			dashboardQueries.getTodayStats(db, userId),
			dashboardQueries.getCashFlow(db, userId, 6)
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

		// Calculate PPh Final 0.5% tax from monthly income
		const currentMonthTax = Math.floor(summary.monthlyIncome * 0.005);

		// Tax threshold for WP OP (Perorangan)
		const TAX_THRESHOLD_WP_OP = 500000000; // 500 juta

		return {
			dashboard: {
				totalBalance,
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
				annualRevenue: summary.yearToDateRevenue,
				currentMonthTax,
				currentMonthRevenue: summary.monthlyIncome,
				taxThreshold: TAX_THRESHOLD_WP_OP,
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

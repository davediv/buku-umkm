import { describe, expect, it } from 'vitest';
import {
	calculateBalanceSheetAsOf,
	type HistoricalAccount,
	type HistoricalDebt,
	type HistoricalTransaction
} from './balance-sheet';

function account(overrides: Partial<HistoricalAccount> = {}): HistoricalAccount {
	return {
		id: 'cash-1',
		name: 'Kas',
		code: '1101',
		type: 'asset',
		subType: 'kas',
		isActive: true,
		openingBalance: 1_000_000,
		openingDate: '2026-01-01',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		...overrides
	};
}

function transaction(overrides: Partial<HistoricalTransaction> = {}): HistoricalTransaction {
	return {
		accountId: 'cash-1',
		date: '2026-01-10',
		type: 'income',
		amount: 500_000,
		debtId: null,
		toAccountId: null,
		...overrides
	};
}

function debt(overrides: Partial<HistoricalDebt> = {}): HistoricalDebt {
	return {
		id: 'debt-1',
		type: 'piutang',
		contactName: 'Budi',
		originalAmount: 1_000_000,
		date: '2026-01-05',
		dueDate: null,
		isActive: true,
		payments: [],
		...overrides
	};
}

describe('historical balance sheet', () => {
	it('uses the opening balance and only movements through the selected date', () => {
		const report = calculateBalanceSheetAsOf(
			'2026-01-31',
			[account()],
			[transaction(), transaction({ date: '2026-02-01', type: 'expense', amount: 100_000 })],
			[]
		);

		expect(report.assets.breakdown.kas.items[0].balance).toBe(1_500_000);
		expect(report.equity.components).toEqual([
			{ name: 'Modal dari saldo awal', amount: 1_000_000 },
			{ name: 'Akumulasi hasil usaha', amount: 500_000 },
			{ name: 'Dampak pengakuan hutang/piutang', amount: 0 }
		]);
		expect(report.isBalanced).toBe(true);
	});

	it('does not apply an opening balance before its effective date', () => {
		const report = calculateBalanceSheetAsOf('2025-12-31', [account()], [], []);

		expect(report.assets.total).toBe(0);
		expect(report.equity.total).toBe(0);
	});

	it('calculates debt balances from payments made by the selected date', () => {
		const receivable = debt({
			payments: [
				{ amount: 400_000, date: '2026-01-20' },
				{ amount: 300_000, date: '2026-02-20' }
			]
		});
		const payable = debt({
			id: 'debt-2',
			type: 'hutang',
			contactName: 'Supplier',
			originalAmount: 500_000,
			date: '2026-01-10',
			payments: [{ amount: 100_000, date: '2026-01-15' }]
		});
		const report = calculateBalanceSheetAsOf(
			'2026-01-31',
			[account()],
			[
				transaction({
					date: '2026-01-20',
					amount: 400_000,
					debtId: 'debt-1'
				}),
				transaction({
					date: '2026-01-15',
					type: 'expense',
					amount: 100_000,
					debtId: 'debt-2'
				})
			],
			[receivable, payable]
		);

		expect(report.assets.breakdown.piutangDetail.subtotal).toBe(600_000);
		expect(report.liabilities.total).toBe(400_000);
		expect(report.assets.total).toBe(1_900_000);
		expect(report.equity.total).toBe(1_500_000);
		expect(report.isBalanced).toBe(true);
	});

	it('reports a real reconciliation difference instead of manufacturing equity', () => {
		const receivable = debt({
			payments: [{ amount: 400_000, date: '2026-01-20' }]
		});
		const report = calculateBalanceSheetAsOf('2026-01-31', [account()], [], [receivable]);

		expect(report.assets.total).toBe(1_600_000);
		expect(report.equity.total).toBe(2_000_000);
		expect(report.isBalanced).toBe(false);
		expect(report.equation.result - report.equation.expected).toBe(-400_000);
	});
});

import { describe, expect, it } from 'vitest';
import { getDebtDueState, getDebtList, type DebtListRecord } from './list';
import { parseDebtQuery } from './query';

const records: DebtListRecord[] = [
	{
		id: 'receivable-overdue',
		type: 'piutang',
		contactName: 'Budi',
		contactPhone: '0812',
		contactAddress: null,
		originalAmount: 500_000,
		paidAmount: 100_000,
		remainingAmount: 400_000,
		date: '2026-08-01',
		dueDate: '2026-08-20',
		description: 'Pesanan toko',
		status: 'active'
	},
	{
		id: 'receivable-soon',
		type: 'piutang',
		contactName: 'Citra',
		contactPhone: null,
		contactAddress: null,
		originalAmount: 200_000,
		paidAmount: 0,
		remainingAmount: 200_000,
		date: '2026-08-25',
		dueDate: '2026-09-03',
		description: null,
		status: 'active'
	},
	{
		id: 'payable-paid',
		type: 'hutang',
		contactName: 'Toko Makmur',
		contactPhone: null,
		contactAddress: null,
		originalAmount: 300_000,
		paidAmount: 300_000,
		remainingAmount: 0,
		date: '2026-08-01',
		dueDate: '2026-08-15',
		description: null,
		status: 'paid'
	}
];

describe('debt list model', () => {
	it('derives overdue and due-soon urgency from dates', () => {
		expect(getDebtDueState(records[0], '2026-08-30')).toMatchObject({
			kind: 'overdue',
			label: 'Terlambat 10 hari'
		});
		expect(getDebtDueState(records[1], '2026-08-30')).toMatchObject({
			kind: 'due-soon',
			label: 'Jatuh tempo 4 hari lagi'
		});
	});

	it('keeps global totals accurate while filtering one tab', () => {
		const result = getDebtList(
			records,
			parseDebtQuery(new URLSearchParams('type=hutang&status=paid')),
			'2026-08-30'
		);

		expect(result.items.map((item) => item.id)).toEqual(['payable-paid']);
		expect(result.summary.piutang).toMatchObject({
			remaining: 600_000,
			overdueCount: 1,
			dueSoonCount: 1
		});
		expect(result.summary.hutang).toMatchObject({ remaining: 0, count: 1 });
	});

	it('filters urgency and sorts the most urgent item first', () => {
		const overdue = getDebtList(
			records,
			parseDebtQuery(new URLSearchParams('type=piutang&due=overdue')),
			'2026-08-30'
		);
		const all = getDebtList(
			records,
			parseDebtQuery(new URLSearchParams('type=piutang&status=all&sort=urgency')),
			'2026-08-30'
		);

		expect(overdue.items.map((item) => item.id)).toEqual(['receivable-overdue']);
		expect(all.items.map((item) => item.id)).toEqual(['receivable-overdue', 'receivable-soon']);
	});
});

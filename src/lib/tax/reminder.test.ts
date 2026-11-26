import { describe, expect, it } from 'vitest';
import { findOutstandingMonths, reminderPeriod, reminderUrgency } from './reminder';
import { jakartaToday } from './period';

const day = (date: string) => jakartaToday(new Date(`${date}T05:00:00Z`));

describe('reminderPeriod', () => {
	it('checks every earlier month of the current year', () => {
		expect(reminderPeriod(day('2026-11-27'))).toEqual({
			year: 2026,
			months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		});
	});

	it('checks December of the previous year in January', () => {
		expect(reminderPeriod(day('2027-01-10'))).toEqual({ year: 2026, months: [12] });
	});
});

describe('findOutstandingMonths', () => {
	const monthlyTax = [0, 500_000, 650_000, 400_000, 0, 0, 0, 0, 0, 300_000, 0, 0];

	it('lists unpaid and underpaid months, oldest first, and skips paid ones', () => {
		const items = findOutstandingMonths({
			year: 2026,
			months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			monthlyTax,
			records: [
				{ month: 2, status: 'paid', taxAmount: 500_000, paidAmount: 500_000 },
				{ month: 3, status: 'paid', taxAmount: 500_000, paidAmount: 500_000 }
			],
			today: '2026-11-27'
		});

		expect(items.map((item) => [item.month, item.status, item.outstandingAmount])).toEqual([
			[3, 'underpaid', 150_000],
			[4, 'unpaid', 400_000],
			[10, 'unpaid', 300_000]
		]);
		expect(items[2].dueDate).toBe('2026-11-15');
		expect(items[2].billingCodeUrl).toBe('/pajak/kode-billing/2026/10');
	});

	it('counts days to a future due date and negative days once overdue', () => {
		const [march] = findOutstandingMonths({
			year: 2026,
			months: [3],
			monthlyTax,
			records: [],
			today: '2026-04-10'
		});
		expect(march.dueDate).toBe('2026-04-15');
		expect(march.daysUntilDue).toBe(5);

		const [late] = findOutstandingMonths({
			year: 2026,
			months: [3],
			monthlyTax,
			records: [],
			today: '2026-04-20'
		});
		expect(late.daysUntilDue).toBe(-5);
	});
});

describe('reminderUrgency', () => {
	const item = (daysUntilDue: number) =>
		({ daysUntilDue }) as Parameters<typeof reminderUrgency>[0][number];

	it('follows the most urgent month', () => {
		expect(reminderUrgency([item(20), item(12)])).toBe('low');
		expect(reminderUrgency([item(20), item(8)])).toBe('medium');
		expect(reminderUrgency([item(20), item(3)])).toBe('high');
		expect(reminderUrgency([item(20), item(-30)])).toBe('high');
	});
});

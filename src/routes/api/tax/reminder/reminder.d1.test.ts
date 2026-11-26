import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { taxProfile, taxRecord } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { TAX_LEGAL_FORM, TAX_REGIME_CHOICE } from '$lib/tax/config';
import type { OutstandingMonth } from '$lib/tax/reminder';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('$lib/server/db', () => ({ getDb: () => dbRef.current }));

import { GET } from './+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
}, 60_000);

afterEach(() => {
	vi.useRealTimers();
});

afterAll(async () => {
	await harness?.dispose();
});

/** A 2026 perseroan perorangan (taxed from the first Rupiah) with the given monthly turnover. */
async function userWithTurnover(turnover: Record<number, number>) {
	const userId = await harness.createUser();
	const external = Array.from({ length: 12 }, (_, index) => turnover[index + 1] ?? 0);
	await harness.db.insert(taxProfile).values({
		userId,
		taxYear: 2026,
		legalForm: TAX_LEGAL_FORM.SINGLE_MEMBER_COMPANY,
		registeredAt: '2023-02-01',
		finalRegimeStartYear: 2023,
		regimeChoice: TAX_REGIME_CHOICE.FINAL_UMKM,
		priorYearAggregatedRevenue: 300_000_000,
		externalMonthlyRevenue: JSON.stringify(external),
		revenueDataComplete: true,
		aggregationConfirmed: true,
		groupTurnoverExceeded: false
	});
	return userId;
}

async function markPaidRecord(userId: string, month: number, paidAmount: number) {
	await harness.db.insert(taxRecord).values({
		userId,
		year: 2026,
		month,
		taxType: 'pph_final',
		taxableIncome: paidAmount * 200,
		taxRate: 50,
		taxAmount: paidAmount,
		paidAmount,
		status: 'paid',
		paymentDate: '2026-04-10'
	});
}

async function reminderAt(userId: string, instant: string) {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(instant));
	const response = await GET({
		locals: { user: { id: userId }, session: { id: `session-${userId}` } }
	} as unknown as Parameters<typeof GET>[0]);
	vi.useRealTimers();
	return (await response.json()) as {
		data: { showReminder: boolean; items?: OutstandingMonth[]; totalOutstanding?: number };
	};
}

describe('tax reminder on D1', () => {
	it('lists every earlier unpaid or underpaid month of the year, not just last month', async () => {
		// Tax: February Rp500.000 (paid), March Rp500.000 (Rp300.000 paid), October Rp500.000.
		const userId = await userWithTurnover({ 2: 100_000_000, 3: 100_000_000, 10: 100_000_000 });
		await markPaidRecord(userId, 2, 500_000);
		await markPaidRecord(userId, 3, 300_000);

		// 10:00 WIB on 27 November 2026.
		const { data } = await reminderAt(userId, '2026-11-27T03:00:00Z');

		expect(data.showReminder).toBe(true);
		expect(data.items?.map((item) => [item.month, item.status, item.outstandingAmount])).toEqual([
			[3, 'underpaid', 200_000],
			[10, 'unpaid', 500_000]
		]);
		expect(data.totalOutstanding).toBe(700_000);
	});

	it('keeps every unpaid month of the previous year after the year ends', async () => {
		const userId = await userWithTurnover({ 10: 100_000_000, 12: 200_000_000 });

		// 08:00 WIB on 10 January 2027, then 08:00 WIB on 2 March 2027.
		for (const at of ['2027-01-10T01:00:00Z', '2027-03-02T01:00:00Z']) {
			const { data } = await reminderAt(userId, at);
			expect(data.items?.map((item) => [item.year, item.month, item.outstandingAmount])).toEqual([
				[2026, 10, 500_000],
				[2026, 12, 1_000_000]
			]);
		}
	});

	it('stays quiet when every earlier month is paid in full', async () => {
		const userId = await userWithTurnover({ 2: 100_000_000 });
		await markPaidRecord(userId, 2, 500_000);

		const { data } = await reminderAt(userId, '2026-11-27T03:00:00Z');

		expect(data.showReminder).toBe(false);
	});
});

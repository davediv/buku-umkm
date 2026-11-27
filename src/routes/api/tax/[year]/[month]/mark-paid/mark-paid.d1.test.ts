import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { taxProfile, taxRecord } from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { TAX_LEGAL_FORM, TAX_REGIME_CHOICE } from '#lib/tax/config.ts';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('#lib/server/db/index.ts', () => ({ getDb: () => dbRef.current }));

import { POST } from './+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

/** A perseroan perorangan eligible for 2026 with Rp100 juta of October turnover (tax Rp500.000). */
async function eligibleUser() {
	const userId = await harness.createUser();
	const external = Array(12).fill(0);
	external[9] = 100_000_000;
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

function markPaid(userId: string, body: unknown, year = '2026', month = '10') {
	return POST({
		locals: { user: { id: userId }, session: { id: `session-${userId}` } },
		params: { year, month },
		request: new Request(`https://buku.test/api/tax/${year}/${month}/mark-paid`, {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof POST>[0]);
}

const recordsFor = (userId: string) =>
	harness.db
		.select()
		.from(taxRecord)
		.where(and(eq(taxRecord.userId, userId), eq(taxRecord.year, 2026), eq(taxRecord.month, 10)));

describe('mark-paid on D1', () => {
	it('keeps one record when the same month is submitted twice at once', async () => {
		const userId = await eligibleUser();

		const responses = await Promise.all([
			markPaid(userId, { paidAmount: 500_000, paymentDate: '2026-11-10' }),
			markPaid(userId, { paidAmount: 500_000, paymentDate: '2026-11-11' })
		]);

		expect(responses.map((response) => response.status)).toEqual([200, 200]);
		const records = await recordsFor(userId);
		expect(records).toHaveLength(1);
		expect(records[0].status).toBe('paid');
		expect(records[0].taxAmount).toBe(500_000);
	});

	it('updates the existing record on a later submit', async () => {
		const userId = await eligibleUser();
		const first = (await (
			await markPaid(userId, { paidAmount: 500_000, paymentDate: '2026-11-10' })
		).json()) as {
			data: { id: string };
		};

		const second = (await (
			await markPaid(userId, { paidAmount: 500_000, paymentDate: '2026-11-12' })
		).json()) as {
			data: { id: string };
		};

		expect(second.data.id).toBe(first.data.id);
		const records = await recordsFor(userId);
		expect(records).toHaveLength(1);
		expect(records[0].paymentDate).toBe('2026-11-12');
	});

	it('records the amount actually paid and reports the shortfall', async () => {
		const userId = await eligibleUser();

		const response = await markPaid(userId, {
			paidAmount: 350_000,
			paymentDate: '2026-11-10',
			billingCode: '1234 5678 9012 345'
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as { data: { underpaidAmount: number } };
		expect(body.data.underpaidAmount).toBe(150_000);
		const [record] = await recordsFor(userId);
		expect(record.paidAmount).toBe(350_000);
		expect(record.taxAmount).toBe(500_000);
		expect(record.billingCode).toBe('123456789012345');
	});

	it.each([
		['no paid amount', { paymentDate: '2026-11-10' }],
		['a formatted string amount', { paidAmount: '500.000' }],
		['a negative amount', { paidAmount: -1 }],
		['a fractional amount', { paidAmount: 1.5 }],
		['a payment date in the future', { paidAmount: 500_000, paymentDate: '2999-01-01' }],
		[
			'a payment date that is not a calendar date',
			{ paidAmount: 500_000, paymentDate: '2026-02-30' }
		],
		['a malformed billing code', { paidAmount: 500_000, billingCode: '12345' }]
	])('rejects %s without writing', async (_label, body) => {
		const userId = await eligibleUser();

		const response = await markPaid(userId, body);

		expect(response.status).toBe(400);
		expect(await recordsFor(userId)).toHaveLength(0);
	});
});

describe('migration 0009 deduplicates tax records', () => {
	it('keeps the latest record of each period before adding the unique index', async () => {
		const [dedupe, , createIndex] = readFileSync(
			'drizzle/0009_tax_record_unique_period.sql',
			'utf8'
		)
			.split('--> statement-breakpoint')
			.map((statement) => statement.trim());
		const userId = await harness.createUser();
		await harness.d1.prepare('DROP INDEX `tax_record_user_period_type_unique`').run();
		const row = (id: string, month: number | null, updatedAt: number) => ({
			id,
			userId,
			year: 2025,
			month,
			taxType: 'pph_final',
			taxableIncome: 1_000_000,
			taxRate: 50,
			taxAmount: 5_000,
			status: 'paid',
			createdAt: new Date(1_700_000_000_000),
			updatedAt: new Date(updatedAt)
		});
		await harness.db
			.insert(taxRecord)
			.values([
				row('old', 3, 1_700_000_000_000),
				row('latest', 3, 1_700_000_500_000),
				row('middle', 3, 1_700_000_200_000),
				row('only', 4, 1_700_000_000_000),
				row('annual-a', null, 1_700_000_000_000),
				row('annual-b', null, 1_700_000_100_000)
			]);

		await harness.d1.prepare(dedupe).run();
		await harness.d1.prepare(createIndex).run();

		const remaining = await harness.db
			.select({ id: taxRecord.id })
			.from(taxRecord)
			.where(eq(taxRecord.userId, userId));
		expect(remaining.map((record) => record.id).sort()).toEqual([
			'annual-a',
			'annual-b',
			'latest',
			'only'
		]);
	});
});

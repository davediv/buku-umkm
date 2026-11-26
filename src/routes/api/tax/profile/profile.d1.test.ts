import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { taxProfile } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { MAX_RUPIAH_INPUT } from '$lib/tax/payments';

const dbRef = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('$lib/server/db', () => ({ getDb: () => dbRef.current }));

import { PUT } from './+server';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
	dbRef.current = harness.db;
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

function validBody(): Record<string, unknown> {
	return {
		taxYear: 2026,
		legalForm: 'individual',
		registeredAt: '2024-01-10',
		finalRegimeStartYear: 2024,
		regimeChoice: 'final_umkm',
		everUsedGeneralRegime: false,
		priorYearAggregatedRevenue: 750_000_000,
		externalMonthlyRevenue: Array(12).fill(0),
		revenueDataComplete: true,
		aggregationConfirmed: true,
		hasProfessionalServiceIncome: false,
		soleOwnerProvidesProfessionalServices: false,
		usesOtherTaxFacility: false,
		groupTurnoverExceeded: false
	};
}

async function put(userId: string, body: unknown) {
	return PUT({
		locals: { user: { id: userId }, session: { id: `session-${userId}` } },
		request: new Request('https://buku.test/api/tax/profile', {
			method: 'PUT',
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof PUT>[0]);
}

const profilesOf = (userId: string) =>
	harness.db.select().from(taxProfile).where(eq(taxProfile.userId, userId));

const months = (value: unknown) => {
	const external: unknown[] = Array(12).fill(0);
	external[4] = value;
	return external;
};

describe('tax profile API amounts', () => {
	it('saves whole-Rupiah JSON numbers as given', async () => {
		const userId = await harness.createUser();
		const body = { ...validBody(), externalMonthlyRevenue: months(1_250_000) };

		const response = await put(userId, body);

		expect(response.status).toBe(200);
		const [saved] = await profilesOf(userId);
		expect(saved.priorYearAggregatedRevenue).toBe(750_000_000);
		expect(JSON.parse(saved.externalMonthlyRevenue)[4]).toBe(1_250_000);
	});

	it('accepts amounts up to the cap', async () => {
		const userId = await harness.createUser();

		const response = await put(userId, {
			...validBody(),
			priorYearAggregatedRevenue: MAX_RUPIAH_INPUT
		});

		expect(response.status).toBe(200);
	});

	it.each([
		['a formatted string turnover', { priorYearAggregatedRevenue: '750.000' }],
		['a numeric string turnover', { priorYearAggregatedRevenue: '750000' }],
		['an empty string turnover', { priorYearAggregatedRevenue: '' }],
		['a negative turnover', { priorYearAggregatedRevenue: -1 }],
		['a fractional turnover', { priorYearAggregatedRevenue: 0.5 }],
		['a turnover above the cap', { priorYearAggregatedRevenue: MAX_RUPIAH_INPUT + 1 }],
		['a string monthly amount', { externalMonthlyRevenue: months('750.000') }],
		['a null monthly amount', { externalMonthlyRevenue: months(null) }],
		['a monthly amount above the cap', { externalMonthlyRevenue: months(MAX_RUPIAH_INPUT + 1) }],
		['eleven months', { externalMonthlyRevenue: Array(11).fill(0) }],
		['a string tax year', { taxYear: '2026' }],
		['a string start year', { finalRegimeStartYear: '2024' }],
		['a legal form wrapped in an array', { legalForm: ['individual'] }],
		['a registration date in the future', { registeredAt: '2999-01-01' }]
	])('rejects %s without saving', async (_label, override) => {
		const userId = await harness.createUser();

		const response = await put(userId, { ...validBody(), ...override });

		expect(response.status).toBe(400);
		expect(await profilesOf(userId)).toHaveLength(0);
	});
});

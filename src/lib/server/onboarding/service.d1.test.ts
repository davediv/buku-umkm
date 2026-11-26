import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { BusinessType } from '$lib/constants';
import { category, chartOfAccount, transactionTemplate } from '$lib/server/db/schema';
import { getCategoryTemplate, getTransactionTemplate } from '$lib/server/db/seed/accounts';
import { createTestD1 } from '$lib/server/testing/d1';
import { completeOnboarding } from './service';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

const businessTypes: BusinessType[] = [
	'warung_makan',
	'toko_kelontong',
	'jasa',
	'manufaktur',
	'toko_online',
	'lainnya'
];

describe('onboarding on D1', () => {
	it.each(businessTypes)('seeds every category and template for %s', async (businessType) => {
		const userId = await harness.createUser();
		const result = await completeOnboarding(harness.db, userId, {
			businessName: 'Usaha Uji',
			ownerName: 'Pemilik',
			businessType,
			accountName: 'Kas Utama',
			accountType: 'kas',
			openingBalance: 500_000,
			openingDate: '2026-11-01'
		});

		expect(result).toEqual({ status: 'completed', created: true });
		const seedType =
			businessType === 'toko_online'
				? 'toko_kelontong'
				: businessType === 'lainnya'
					? 'jasa'
					: businessType;
		const [categories, templates, accounts] = await Promise.all([
			harness.db.select().from(category).where(eq(category.userId, userId)),
			harness.db.select().from(transactionTemplate).where(eq(transactionTemplate.userId, userId)),
			harness.db.select().from(chartOfAccount).where(eq(chartOfAccount.userId, userId))
		]);
		expect(categories).toHaveLength(getCategoryTemplate(seedType).length);
		expect(templates).toHaveLength(getTransactionTemplate(seedType).length);
		expect(accounts).toMatchObject([{ name: 'Kas Utama', balance: 500_000 }]);
	});
});

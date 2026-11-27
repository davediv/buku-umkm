import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { chartOfAccount } from '#lib/server/db/schema.ts';
import { dashboardQueries } from '#lib/server/db/queries/index.ts';
import { getBalanceSheetAsOf } from '#lib/server/reports/balance-sheet.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { parseAccountName } from '#lib/shared/account-types.ts';
import { todayInJakarta } from '#lib/shared/dates.ts';
import { deactivateAccount, reactivateAccount } from './accounts';
import { createFinancialMutationService } from './commands';
import { createD1FinanceRepository } from './repository';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

async function account(userId: string, balance: number, isActive = true) {
	const id = crypto.randomUUID();
	await harness.db.insert(chartOfAccount).values({
		id,
		userId,
		code: '1001',
		name: 'Kas',
		type: 'asset',
		subType: 'kas',
		isActive,
		balance,
		openingBalance: balance,
		openingDate: '2026-01-01'
	});
	return id;
}

async function isActive(accountId: string) {
	const [row] = await harness.db
		.select({ isActive: chartOfAccount.isActive })
		.from(chartOfAccount)
		.where(eq(chartOfAccount.id, accountId));
	return row.isActive;
}

describe('account deactivation on D1', () => {
	it('deactivates only an empty account without transactions', async () => {
		const userId = await harness.createUser();
		const [empty, funded, used] = [
			await account(userId, 0),
			await account(userId, 250_000),
			await account(userId, 0)
		];
		const service = createFinancialMutationService(createD1FinanceRepository(harness.db));
		const sale = await service.createTransaction(userId, 'acct-key-0001', {
			type: 'income',
			amount: 10_000,
			accountId: used,
			categoryId: null,
			date: '2026-11-01',
			description: null
		});
		await service.deleteTransaction(userId, sale.entity.id);

		expect(await deactivateAccount(harness.db, userId, funded)).toBe('has_balance');
		expect(await deactivateAccount(harness.db, userId, used)).toBe('has_transactions');
		expect(await deactivateAccount(harness.db, userId, empty)).toBe('deactivated');
		expect(await deactivateAccount(harness.db, userId, empty)).toBe('already_inactive');
		expect(await deactivateAccount(harness.db, 'someone-else', funded)).toBe('not_found');
		expect([await isActive(empty), await isActive(funded), await isActive(used)]).toEqual([
			false,
			true,
			true
		]);
	});

	it('reactivates an account deactivated while it held money', async () => {
		const userId = await harness.createUser();
		const legacy = await account(userId, 400_000, false);
		const repository = createD1FinanceRepository(harness.db);
		expect(await repository.findAccount(userId, legacy)).toBeUndefined();

		expect(await reactivateAccount(harness.db, 'someone-else', legacy)).toBe('not_found');
		expect(await isActive(legacy)).toBe(false);
		expect(await reactivateAccount(harness.db, userId, legacy)).toBe('reactivated');
		expect(await reactivateAccount(harness.db, userId, legacy)).toBe('already_active');

		// Back in new entries, with its balance untouched.
		expect(await repository.findAccount(userId, legacy)).toMatchObject({
			isActive: true,
			balance: 400_000
		});
	});

	it('keeps a legacy deactivated balance in both the dashboard and the balance sheet', async () => {
		const userId = await harness.createUser();
		await account(userId, 1_000_000);
		await account(userId, 400_000, false);

		const overview = await dashboardQueries.getOverview(harness.db, userId, 'monthly');
		const sheet = await getBalanceSheetAsOf(harness.db, userId, todayInJakarta());
		expect(overview.summary.totalAssets).toBe(1_400_000);
		expect(sheet.assets.total).toBe(1_400_000);
		expect(overview.summary.netWorth).toBe(sheet.equity.total);
	});
});

describe('parseAccountName', () => {
	it('requires a trimmed name of at most 100 characters', () => {
		expect(parseAccountName('  Kas Toko ')).toEqual({ ok: true, name: 'Kas Toko' });
		expect(parseAccountName('   ')).toMatchObject({ ok: false });
		expect(parseAccountName(42)).toMatchObject({ ok: false });
		expect(parseAccountName(null)).toMatchObject({ ok: false });
		expect(parseAccountName('a'.repeat(100))).toMatchObject({ ok: true });
		expect(parseAccountName('a'.repeat(101))).toEqual({
			ok: false,
			error: 'Nama akun maksimal 100 karakter'
		});
	});
});

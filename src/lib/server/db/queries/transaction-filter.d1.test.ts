import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chartOfAccount } from '$lib/server/db/schema';
import { createD1FinanceRepository } from '$lib/server/finance/repository';
import { createFinancialMutationService } from '$lib/server/finance/commands';
import { createTestD1 } from '$lib/server/testing/d1';
import { transactionQueries } from './index';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('transaction list type filter', () => {
	it('finds transfer legs under "transfer" and keeps them out of income and expense', async () => {
		const { db } = harness;
		const userId = await harness.createUser();
		const [kas, bank] = [crypto.randomUUID(), crypto.randomUUID()];
		await db.insert(chartOfAccount).values([
			{
				id: kas,
				userId,
				code: '1001',
				name: 'Kas',
				type: 'asset',
				subType: 'kas',
				balance: 500_000,
				openingBalance: 500_000,
				openingDate: '2026-11-01'
			},
			{
				id: bank,
				userId,
				code: '1002',
				name: 'Bank',
				type: 'asset',
				subType: 'bank',
				balance: 0,
				openingBalance: 0,
				openingDate: '2026-11-01'
			}
		]);
		const service = createFinancialMutationService(createD1FinanceRepository(db));
		await service.createTransaction(userId, 'filter-income-1', {
			type: 'income',
			amount: 100_000,
			accountId: kas,
			categoryId: null,
			date: '2026-11-10',
			description: 'Penjualan'
		});
		await service.createTransfer(userId, 'filter-transfer-1', {
			amount: 50_000,
			sourceAccountId: kas,
			destinationAccountId: bank,
			date: '2026-11-11',
			description: null
		});

		const descriptions = async (type: 'income' | 'expense' | 'transfer') =>
			(await transactionQueries.findAll(db, userId, { type })).map((row) => row.description).sort();

		expect(await transactionQueries.count(db, userId, { type: 'transfer' })).toBe(2);
		expect(await descriptions('transfer')).toEqual(['Transfer dari Kas', 'Transfer ke Bank']);
		expect(await descriptions('income')).toEqual(['Penjualan']);
		expect(await descriptions('expense')).toEqual([]);
	});
});

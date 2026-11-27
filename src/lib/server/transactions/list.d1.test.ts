import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chartOfAccount } from '#lib/server/db/schema.ts';
import { createFinancialMutationService } from '#lib/server/finance/commands.ts';
import { createD1FinanceRepository } from '#lib/server/finance/repository.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { parseTransactionQuery } from '#lib/transactions/query.ts';
import { getTransactionPage } from './list';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('transaction list on D1', () => {
	it("marks a loan payment's interest row with its loan so the list links to it", async () => {
		const { db } = harness;
		const userId = await harness.createUser();
		const kas = crypto.randomUUID();
		await db.insert(chartOfAccount).values({
			id: kas,
			userId,
			code: '1001',
			name: 'Kas',
			type: 'asset',
			subType: 'kas',
			balance: 2_000_000,
			openingBalance: 2_000_000,
			openingDate: '2026-11-01'
		});
		const service = createFinancialMutationService(createD1FinanceRepository(db));
		const { entity: loan } = await service.createDebt(userId, 'list-loan-0001', {
			type: 'hutang',
			kind: 'loan',
			accountId: kas,
			contactName: 'Koperasi Maju',
			contactPhone: null,
			contactAddress: null,
			originalAmount: 1_000_000,
			date: '2026-11-02',
			dueDate: null,
			description: null
		});
		await service.recordDebtPayment(userId, loan.id, 'list-pay-0001', {
			amount: 200_000,
			interestAmount: 20_000,
			date: '2026-11-20',
			accountId: kas,
			notes: null
		});

		const page = await getTransactionPage(
			db,
			userId,
			parseTransactionQuery(new URLSearchParams('range=all'))
		);
		const interest = page.transactions.find((row) => row.description?.startsWith('Bunga'));
		expect(interest).toMatchObject({ amount: 20_000, debtId: null, interestDebtId: loan.id });
		expect(page.transactions.filter((row) => row.interestDebtId)).toHaveLength(1);
	});
});

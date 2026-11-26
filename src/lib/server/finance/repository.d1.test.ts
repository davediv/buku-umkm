import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	chartOfAccount,
	debt,
	debtPayment,
	financialCommand,
	transaction
} from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { createFinancialMutationService } from './commands';
import { createD1FinanceRepository } from './repository';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

async function setup(openingBalance = 1_000_000) {
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
			balance: openingBalance,
			openingBalance,
			openingDate: '2026-01-01'
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
			openingDate: '2026-01-01'
		}
	]);
	const repository = createD1FinanceRepository(db);
	return { userId, kas, bank, repository, service: createFinancialMutationService(repository) };
}

async function balanceOf(accountId: string) {
	const [row] = await harness.db
		.select({ balance: chartOfAccount.balance })
		.from(chartOfAccount)
		.where(eq(chartOfAccount.id, accountId));
	return row.balance;
}

async function countRows(table: typeof transaction | typeof financialCommand, userId: string) {
	return (await harness.db.select().from(table).where(eq(table.userId, userId))).length;
}

describe('financial writes on D1', () => {
	it('records, edits and deletes a transaction with matching balance changes', async () => {
		const { userId, kas, service } = await setup();
		const created = await service.createTransaction(userId, 'tx-key-0001', {
			type: 'income',
			amount: 150_000,
			accountId: kas,
			categoryId: null,
			date: '2026-11-20',
			description: 'Penjualan'
		});
		expect(created.replayed).toBe(false);
		expect(await balanceOf(kas)).toBe(1_150_000);

		const replay = await service.createTransaction(userId, 'tx-key-0001', {
			type: 'income',
			amount: 150_000,
			accountId: kas,
			categoryId: null,
			date: '2026-11-20',
			description: 'Penjualan'
		});
		expect(replay).toMatchObject({ replayed: true, entity: { id: created.entity.id } });
		expect(await countRows(transaction, userId)).toBe(1);

		await service.updateTransaction(userId, created.entity.id, { amount: 100_000 });
		expect(await balanceOf(kas)).toBe(1_100_000);

		await service.deleteTransaction(userId, created.entity.id);
		expect(await balanceOf(kas)).toBe(1_000_000);
	});

	it('moves money between accounts and rejects a transfer the source cannot cover', async () => {
		const { userId, kas, bank, service } = await setup(100_000);
		await service.createTransfer(userId, 'tf-key-0001', {
			amount: 60_000,
			sourceAccountId: kas,
			destinationAccountId: bank,
			date: '2026-11-20',
			description: null
		});
		expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([40_000, 60_000]);

		await expect(
			service.createTransfer(userId, 'tf-key-0002', {
				amount: 50_000,
				sourceAccountId: kas,
				destinationAccountId: bank,
				date: '2026-11-21',
				description: null
			})
		).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
		// The guard aborts the whole batch: no command, no legs, no balance change.
		expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([40_000, 60_000]);
		expect(await countRows(transaction, userId)).toBe(2);
		expect(await countRows(financialCommand, userId)).toBe(1);
	});

	it('records debt payments and settles the debt atomically', async () => {
		const { userId, kas, service } = await setup(0);
		const { entity: receivable } = await service.createDebt(userId, 'debt-key-0001', {
			type: 'piutang',
			contactName: 'Budi',
			contactPhone: null,
			contactAddress: null,
			originalAmount: 200_000,
			date: '2026-11-01',
			dueDate: null,
			description: null
		});

		await service.recordDebtPayment(userId, receivable.id, 'pay-key-0001', {
			amount: 50_000,
			date: '2026-11-10',
			accountId: kas,
			notes: null
		});
		const settled = await service.recordDebtPayment(userId, receivable.id, 'pay-key-0002', {
			amount: 150_000,
			date: '2026-11-20',
			accountId: kas,
			notes: null
		});
		expect(settled.entity.debt).toMatchObject({
			status: 'paid',
			paidAmount: 200_000,
			remainingAmount: 0
		});
		expect(await balanceOf(kas)).toBe(200_000);
	});

	it('aborts a payment batch when a concurrent payment already used the remaining amount', async () => {
		const { userId, kas, repository } = await setup(0);
		const debtId = crypto.randomUUID();
		await harness.db.insert(debt).values({
			id: debtId,
			userId,
			type: 'hutang',
			contactName: 'Toko Sumber',
			originalAmount: 100_000,
			paidAmount: 0,
			remainingAmount: 100_000,
			date: '2026-11-01'
		});
		const paymentInput = (key: string, amount: number) => {
			const transactionId = crypto.randomUUID();
			return {
				command: {
					id: crypto.randomUUID(),
					userId,
					idempotencyKey: key,
					kind: 'debt.payment',
					result: '{}'
				},
				balanceDelta: -amount,
				entry: {
					id: transactionId,
					userId,
					date: '2026-11-10',
					type: 'expense',
					amount,
					accountId: kas,
					debtId
				},
				payment: {
					id: crypto.randomUUID(),
					debtId,
					userId,
					amount,
					date: '2026-11-10',
					accountId: kas,
					transactionId
				}
			};
		};

		// Both requests passed the service's pre-check; only the first may commit.
		await repository.recordDebtPaymentAtomic(paymentInput('race-key-0001', 80_000));
		await expect(
			repository.recordDebtPaymentAtomic(paymentInput('race-key-0002', 80_000))
		).rejects.toMatchObject({
			code: 'OVERPAYMENT'
		});

		const payments = await harness.db
			.select()
			.from(debtPayment)
			.where(eq(debtPayment.debtId, debtId));
		expect(payments).toHaveLength(1);
		expect(await balanceOf(kas)).toBe(-80_000);
		expect(await countRows(financialCommand, userId)).toBe(1);
	});
});

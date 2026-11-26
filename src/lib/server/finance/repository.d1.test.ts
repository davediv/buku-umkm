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
			kind: 'trade',
			accountId: null,
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

	describe('loans', () => {
		const loan = (type: 'piutang' | 'hutang', accountId: string, originalAmount: number) => ({
			type,
			kind: 'loan' as const,
			accountId,
			contactName: 'Koperasi',
			contactPhone: null,
			contactAddress: null,
			originalAmount,
			date: '2026-11-01',
			dueDate: null,
			description: null
		});

		it('moves the principal with the debt and links the two', async () => {
			const { userId, kas, service } = await setup(1_000_000);
			const { entity: received } = await service.createDebt(
				userId,
				'loan-key-0001',
				loan('hutang', kas, 400_000)
			);
			const { entity: given } = await service.createDebt(
				userId,
				'loan-key-0002',
				loan('piutang', kas, 300_000)
			);
			expect(await balanceOf(kas)).toBe(1_100_000);

			const principal = await harness.db
				.select()
				.from(transaction)
				.where(eq(transaction.id, received.principalTransactionId!));
			expect(principal).toMatchObject([
				{ type: 'income', amount: 400_000, accountId: kas, debtId: received.id, isActive: true }
			]);
			expect(given).toMatchObject({ kind: 'loan', principalAccountId: kas });
			expect(given.principalTransactionId).toEqual(expect.any(String));
		});

		it('writes nothing when the account cannot cover a loan given', async () => {
			const { userId, kas, service } = await setup(100_000);
			await expect(
				service.createDebt(userId, 'loan-key-0003', loan('piutang', kas, 150_000))
			).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });

			expect(await balanceOf(kas)).toBe(100_000);
			expect(await countRows(transaction, userId)).toBe(0);
			expect(await countRows(financialCommand, userId)).toBe(0);
			expect(await harness.db.select().from(debt).where(eq(debt.userId, userId))).toEqual([]);
		});

		it('reverses the principal when an unpaid loan is deleted', async () => {
			const { userId, kas, service } = await setup(1_000_000);
			const { entity: given } = await service.createDebt(
				userId,
				'loan-key-0004',
				loan('piutang', kas, 300_000)
			);
			expect(await balanceOf(kas)).toBe(700_000);

			await service.deleteDebt(userId, given.id);
			expect(await balanceOf(kas)).toBe(1_000_000);
			const [principal] = await harness.db
				.select({ isActive: transaction.isActive })
				.from(transaction)
				.where(eq(transaction.id, given.principalTransactionId!));
			expect(principal.isActive).toBe(false);
			await expect(service.deleteDebt(userId, given.id)).rejects.toMatchObject({
				code: 'NOT_FOUND'
			});
			expect(await balanceOf(kas)).toBe(1_000_000);
		});

		it('refuses a delete batch once a payment exists, keeping the principal', async () => {
			const { userId, kas, repository, service } = await setup(1_000_000);
			const { entity: received } = await service.createDebt(
				userId,
				'loan-key-0005',
				loan('hutang', kas, 400_000)
			);
			// The delete passed the service's pre-check before this payment committed.
			await service.recordDebtPayment(userId, received.id, 'loan-pay-0001', {
				amount: 100_000,
				date: '2026-11-10',
				accountId: kas,
				notes: null
			});
			await expect(
				repository.deleteDebtAtomic(userId, received.id, {
					transactionId: received.principalTransactionId!,
					accountId: kas,
					balanceDelta: -400_000
				})
			).rejects.toMatchObject({ code: 'DEBT_HAS_PAYMENTS' });
			expect(await balanceOf(kas)).toBe(1_300_000);
		});
	});

	describe('reversing a debt payment', () => {
		const tradeDebt = (type: 'piutang' | 'hutang', originalAmount: number) => ({
			type,
			kind: 'trade' as const,
			accountId: null,
			contactName: 'Budi',
			contactPhone: null,
			contactAddress: null,
			originalAmount,
			date: '2026-11-01',
			dueDate: null,
			description: null
		});

		async function pay(
			service: Awaited<ReturnType<typeof setup>>['service'],
			userId: string,
			debtId: string,
			accountId: string,
			amount: number
		) {
			const { entity } = await service.recordDebtPayment(userId, debtId, crypto.randomUUID(), {
				amount,
				date: '2026-11-10',
				accountId,
				notes: null
			});
			return entity;
		}

		async function transactionIsActive(transactionId: string) {
			const [row] = await harness.db
				.select({ isActive: transaction.isActive })
				.from(transaction)
				.where(eq(transaction.id, transactionId));
			return row.isActive;
		}

		it('reopens a settled debt and takes the money back out of the account', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: receivable } = await service.createDebt(
				userId,
				'rev-debt-0001',
				tradeDebt('piutang', 200_000)
			);
			await pay(service, userId, receivable.id, kas, 50_000);
			const settled = await pay(service, userId, receivable.id, kas, 150_000);
			expect(settled.debt.status).toBe('paid');
			expect(await balanceOf(kas)).toBe(200_000);

			const reopened = await service.reverseDebtPayment(userId, receivable.id, settled.payment.id);
			expect(reopened).toMatchObject({
				status: 'active',
				paidAmount: 50_000,
				remainingAmount: 150_000
			});
			expect(reopened.payments.map((item) => item.id)).not.toContain(settled.payment.id);
			expect(await balanceOf(kas)).toBe(50_000);
			expect(await transactionIsActive(settled.transaction.id)).toBe(false);

			// The reopened debt takes payments again, up to what it still owes.
			const repaid = await pay(service, userId, receivable.id, kas, 150_000);
			expect(repaid.debt).toMatchObject({ status: 'paid', remainingAmount: 0 });
			expect(await balanceOf(kas)).toBe(200_000);
		});

		it('returns a hutang payment to the account it was paid from', async () => {
			const { userId, kas, service } = await setup(500_000);
			const { entity: payable } = await service.createDebt(
				userId,
				'rev-debt-0002',
				tradeDebt('hutang', 300_000)
			);
			const paid = await pay(service, userId, payable.id, kas, 120_000);
			expect(await balanceOf(kas)).toBe(380_000);

			const reopened = await service.reverseDebtPayment(userId, payable.id, paid.payment.id);
			expect(reopened).toMatchObject({ status: 'active', paidAmount: 0, remainingAmount: 300_000 });
			expect(await balanceOf(kas)).toBe(500_000);
		});

		it('never reverses the same payment twice', async () => {
			const { userId, kas, repository, service } = await setup(0);
			const { entity: receivable } = await service.createDebt(
				userId,
				'rev-debt-0003',
				tradeDebt('piutang', 100_000)
			);
			const paid = await pay(service, userId, receivable.id, kas, 100_000);
			const reversal = {
				userId,
				debtId: receivable.id,
				paymentId: paid.payment.id,
				amount: 100_000,
				movement: { transactionId: paid.transaction.id, accountId: kas, balanceDelta: -100_000 }
			};

			// Two requests passed the service's pre-check; only the first may commit.
			await repository.reverseDebtPaymentAtomic(reversal);
			await expect(repository.reverseDebtPaymentAtomic(reversal)).rejects.toMatchObject({
				code: 'PAYMENT_NOT_FOUND'
			});
			await expect(
				service.reverseDebtPayment(userId, receivable.id, paid.payment.id)
			).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND', status: 404 });

			expect(await balanceOf(kas)).toBe(0);
			const [current] = await harness.db.select().from(debt).where(eq(debt.id, receivable.id));
			expect(current).toMatchObject({ status: 'active', paidAmount: 0, remainingAmount: 100_000 });
		});

		it("refuses another user's payment and a payment of a different debt", async () => {
			const owner = await setup(0);
			const other = await setup(0);
			const { entity: first } = await owner.service.createDebt(
				owner.userId,
				'rev-debt-0004',
				tradeDebt('piutang', 100_000)
			);
			const { entity: second } = await owner.service.createDebt(
				owner.userId,
				'rev-debt-0005',
				tradeDebt('piutang', 100_000)
			);
			const paid = await pay(owner.service, owner.userId, first.id, owner.kas, 40_000);

			await expect(
				other.service.reverseDebtPayment(other.userId, first.id, paid.payment.id)
			).rejects.toMatchObject({ code: 'NOT_FOUND' });
			await expect(
				owner.service.reverseDebtPayment(owner.userId, second.id, paid.payment.id)
			).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
			// Even a forged batch for another user aborts on the guard.
			await expect(
				other.repository.reverseDebtPaymentAtomic({
					userId: other.userId,
					debtId: first.id,
					paymentId: paid.payment.id,
					amount: 40_000,
					movement: null
				})
			).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });

			expect(await balanceOf(owner.kas)).toBe(40_000);
			const payments = await harness.db
				.select()
				.from(debtPayment)
				.where(eq(debtPayment.debtId, first.id));
			expect(payments).toHaveLength(1);
		});

		it('answers a replay of a reversed payment request without recording it again', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: receivable } = await service.createDebt(
				userId,
				'rev-debt-0006',
				tradeDebt('piutang', 100_000)
			);
			const input = { amount: 60_000, date: '2026-11-10', accountId: kas, notes: null };
			const paid = await service.recordDebtPayment(userId, receivable.id, 'rev-pay-0001', input);
			await service.reverseDebtPayment(userId, receivable.id, paid.entity.payment.id);

			await expect(
				service.recordDebtPayment(userId, receivable.id, 'rev-pay-0001', input)
			).rejects.toMatchObject({ code: 'PAYMENT_REVERSED', status: 409 });
			expect(await balanceOf(kas)).toBe(0);
		});
	});
});

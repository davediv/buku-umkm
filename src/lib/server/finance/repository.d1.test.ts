import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import {
	category,
	chartOfAccount,
	debt,
	debtPayment,
	financialCommand,
	transaction
} from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
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
				principal: {
					id: transactionId,
					userId,
					date: '2026-11-10',
					type: 'expense',
					amount,
					accountId: kas,
					debtId
				},
				interest: null,
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

	describe('loan interest', () => {
		const loan = (type: 'piutang' | 'hutang', accountId: string, originalAmount: number) => ({
			type,
			kind: 'loan' as const,
			accountId,
			contactName: 'Koperasi Maju',
			contactPhone: null,
			contactAddress: null,
			originalAmount,
			date: '2026-11-01',
			dueDate: null,
			description: null
		});
		const payment = (amount: number, interestAmount: number, accountId: string) => ({
			amount,
			interestAmount,
			date: '2026-11-10',
			accountId,
			notes: null
		});

		async function rowOf(transactionId: string) {
			const [row] = await harness.db
				.select()
				.from(transaction)
				.where(eq(transaction.id, transactionId));
			return row;
		}

		async function categoriesOf(userId: string) {
			return harness.db.select().from(category).where(eq(category.userId, userId));
		}

		it('moves principal and interest out together, reducing the loan by the principal only', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: received } = await service.createDebt(
				userId,
				'int-debt-0001',
				loan('hutang', kas, 1_000_000)
			);
			expect(await balanceOf(kas)).toBe(1_000_000);

			const { entity } = await service.recordDebtPayment(
				userId,
				received.id,
				'int-pay-0001',
				payment(200_000, 15_000, kas)
			);

			expect(await balanceOf(kas)).toBe(785_000);
			expect(entity.debt).toMatchObject({
				status: 'active',
				paidAmount: 200_000,
				remainingAmount: 800_000
			});
			expect(entity.payment).toMatchObject({
				amount: 200_000,
				interestAmount: 15_000,
				transactionId: entity.transaction!.id,
				interestTransactionId: entity.interestTransaction!.id
			});
			expect(await rowOf(entity.transaction!.id)).toMatchObject({
				type: 'expense',
				amount: 200_000,
				debtId: received.id,
				categoryId: null
			});
			// Its own transaction, without the debt link, so it is an expense in the books.
			const interest = await rowOf(entity.interestTransaction!.id);
			expect(interest).toMatchObject({
				type: 'expense',
				amount: 15_000,
				date: '2026-11-10',
				accountId: kas,
				debtId: null,
				toAccountId: null,
				description: 'Bunga pinjaman ke Koperasi Maju',
				isActive: true
			});
			expect(await categoriesOf(userId)).toEqual([
				expect.objectContaining({
					id: interest.categoryId,
					code: '7101',
					name: 'Beban Bunga',
					type: 'expense',
					isSystem: true
				})
			]);
		});

		it('books interest on a loan given as income under its own category, created once', async () => {
			const { userId, kas, service } = await setup(1_000_000);
			const { entity: given } = await service.createDebt(
				userId,
				'int-debt-0002',
				loan('piutang', kas, 600_000)
			);
			const first = await service.recordDebtPayment(
				userId,
				given.id,
				'int-pay-0002',
				payment(100_000, 10_000, kas)
			);
			const second = await service.recordDebtPayment(
				userId,
				given.id,
				'int-pay-0003',
				payment(100_000, 8_000, kas)
			);

			expect(await balanceOf(kas)).toBe(400_000 + 110_000 + 108_000);
			expect(second.entity.debt).toMatchObject({ paidAmount: 200_000, remainingAmount: 400_000 });
			const [firstInterest, secondInterest] = await Promise.all([
				rowOf(first.entity.interestTransaction!.id),
				rowOf(second.entity.interestTransaction!.id)
			]);
			expect(firstInterest).toMatchObject({
				type: 'income',
				amount: 10_000,
				debtId: null,
				description: 'Bunga pinjaman dari Koperasi Maju'
			});
			expect(secondInterest.categoryId).toBe(firstInterest.categoryId);
			expect(await categoriesOf(userId)).toEqual([
				expect.objectContaining({ code: '4901', name: 'Pendapatan Bunga', type: 'income' })
			]);
		});

		it('creates one category when two first interest payments race', async () => {
			const { userId, kas, service } = await setup(0);
			const [a, b] = await Promise.all([
				service.createDebt(userId, 'int-debt-0003', loan('hutang', kas, 500_000)),
				service.createDebt(userId, 'int-debt-0004', loan('hutang', kas, 500_000))
			]);
			// Both looked the category up before either batch created it.
			const [first, second] = await Promise.all([
				service.recordDebtPayment(userId, a.entity.id, 'int-pay-0004', payment(0, 5_000, kas)),
				service.recordDebtPayment(userId, b.entity.id, 'int-pay-0005', payment(0, 7_000, kas))
			]);

			const categories = await categoriesOf(userId);
			expect(categories).toHaveLength(1);
			expect((await rowOf(first.entity.interestTransaction!.id)).categoryId).toBe(categories[0].id);
			expect((await rowOf(second.entity.interestTransaction!.id)).categoryId).toBe(
				categories[0].id
			);
			expect(await balanceOf(kas)).toBe(1_000_000 - 12_000);
		});

		it('records interest alone while the loan is open, leaving the principal as it was', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: received } = await service.createDebt(
				userId,
				'int-debt-0005',
				loan('hutang', kas, 1_000_000)
			);
			const { entity } = await service.recordDebtPayment(
				userId,
				received.id,
				'int-pay-0006',
				payment(0, 20_000, kas)
			);

			expect(entity.transaction).toBeNull();
			expect(entity.payment).toMatchObject({
				amount: 0,
				interestAmount: 20_000,
				transactionId: null
			});
			expect(entity.debt).toMatchObject({
				status: 'active',
				paidAmount: 0,
				remainingAmount: 1_000_000
			});
			expect(await balanceOf(kas)).toBe(980_000);
			// The principal is still owed in full, and can be paid off later.
			const settled = await service.recordDebtPayment(
				userId,
				received.id,
				'int-pay-0007',
				payment(1_000_000, 20_000, kas)
			);
			expect(settled.entity.debt).toMatchObject({ status: 'paid', remainingAmount: 0 });
			await expect(
				service.recordDebtPayment(userId, received.id, 'int-pay-0008', payment(0, 1_000, kas))
			).rejects.toMatchObject({ code: 'ALREADY_PAID' });
		});

		it('refuses interest on a trade debt, writing nothing', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: payable } = await service.createDebt(userId, 'int-debt-0006', {
				...loan('hutang', kas, 300_000),
				kind: 'trade',
				accountId: null
			});

			await expect(
				service.recordDebtPayment(userId, payable.id, 'int-pay-0009', payment(100_000, 5_000, kas))
			).rejects.toMatchObject({ code: 'INTEREST_NOT_ALLOWED', status: 400 });
			expect(await balanceOf(kas)).toBe(0);
			expect(await countRows(transaction, userId)).toBe(0);
			expect(await countRows(financialCommand, userId)).toBe(1);
			expect(await categoriesOf(userId)).toEqual([]);
		});

		it('reverses principal and interest together, restoring the balance for both', async () => {
			const { userId, kas, service } = await setup(1_000_000);
			const { entity: lent } = await service.createDebt(
				userId,
				'int-debt-0007',
				loan('piutang', kas, 500_000)
			);
			const { entity } = await service.recordDebtPayment(
				userId,
				lent.id,
				'int-pay-0010',
				payment(500_000, 25_000, kas)
			);
			expect(entity.debt.status).toBe('paid');
			expect(await balanceOf(kas)).toBe(1_025_000);

			const reopened = await service.reverseDebtPayment(userId, lent.id, entity.payment.id);
			expect(reopened).toMatchObject({
				status: 'active',
				paidAmount: 0,
				remainingAmount: 500_000,
				payments: []
			});
			expect(await balanceOf(kas)).toBe(500_000);
			expect((await rowOf(entity.transaction!.id)).isActive).toBe(false);
			expect((await rowOf(entity.interestTransaction!.id)).isActive).toBe(false);
			await expect(
				service.reverseDebtPayment(userId, lent.id, entity.payment.id)
			).rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
			expect(await balanceOf(kas)).toBe(500_000);
		});

		it('reverses a payment of interest alone', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: received } = await service.createDebt(
				userId,
				'int-debt-0008',
				loan('hutang', kas, 300_000)
			);
			const { entity } = await service.recordDebtPayment(
				userId,
				received.id,
				'int-pay-0011',
				payment(0, 9_000, kas)
			);
			expect(await balanceOf(kas)).toBe(291_000);

			const reopened = await service.reverseDebtPayment(userId, received.id, entity.payment.id);
			expect(reopened).toMatchObject({ paidAmount: 0, remainingAmount: 300_000, payments: [] });
			expect(await balanceOf(kas)).toBe(300_000);
			expect((await rowOf(entity.interestTransaction!.id)).isActive).toBe(false);
		});

		it('answers a replay with both transactions, recording nothing again', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: received } = await service.createDebt(
				userId,
				'int-debt-0009',
				loan('hutang', kas, 300_000)
			);
			const input = payment(100_000, 3_000, kas);
			const first = await service.recordDebtPayment(userId, received.id, 'int-pay-0012', input);
			const replay = await service.recordDebtPayment(userId, received.id, 'int-pay-0012', input);

			expect(replay.replayed).toBe(true);
			expect(replay.entity.transaction?.id).toBe(first.entity.transaction!.id);
			expect(replay.entity.interestTransaction?.id).toBe(first.entity.interestTransaction!.id);
			expect(await balanceOf(kas)).toBe(197_000);
		});

		it('keeps the interest from being edited or deleted apart from its payment', async () => {
			const { userId, kas, service } = await setup(0);
			const { entity: received } = await service.createDebt(
				userId,
				'int-debt-0010',
				loan('hutang', kas, 300_000)
			);
			const { entity } = await service.recordDebtPayment(
				userId,
				received.id,
				'int-pay-0013',
				payment(100_000, 4_000, kas)
			);
			const interestId = entity.interestTransaction!.id;

			await expect(
				service.updateTransaction(userId, interestId, { amount: 1_000 })
			).rejects.toMatchObject({ code: 'LINKED_TRANSACTION', status: 409 });
			await expect(service.deleteTransaction(userId, interestId)).rejects.toMatchObject({
				code: 'LINKED_TRANSACTION',
				status: 409
			});
			expect(await rowOf(interestId)).toMatchObject({ amount: 4_000, isActive: true });
			expect(await balanceOf(kas)).toBe(196_000);
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
			expect(await transactionIsActive(settled.transaction!.id)).toBe(false);

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
				interestAmount: 0,
				movements: [{ transactionId: paid.transaction!.id, accountId: kas, balanceDelta: -100_000 }]
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
					interestAmount: 0,
					movements: []
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

	describe('reversing a transfer', () => {
		async function transfer(
			service: Awaited<ReturnType<typeof setup>>['service'],
			userId: string,
			from: string,
			to: string,
			amount: number,
			key: string = crypto.randomUUID()
		) {
			const { entity } = await service.createTransfer(userId, key, {
				amount,
				sourceAccountId: from,
				destinationAccountId: to,
				date: '2026-11-20',
				description: null
			});
			return entity;
		}

		async function legsActive(...ids: string[]) {
			const rows = await harness.db
				.select({ id: transaction.id, isActive: transaction.isActive })
				.from(transaction)
				.where(inArray(transaction.id, ids));
			return ids.map((id) => rows.find((row) => row.id === id)?.isActive);
		}

		it('soft-deletes both legs and moves the money back', async () => {
			const { userId, kas, bank, service } = await setup(100_000);
			const made = await transfer(service, userId, kas, bank, 60_000);
			expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([40_000, 60_000]);

			await service.reverseTransfer(userId, made.id);
			expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([100_000, 0]);
			expect(await legsActive(made.sourceTransaction.id, made.destinationTransaction.id)).toEqual([
				false,
				false
			]);
		});

		it('refuses when the destination no longer holds the amount, writing nothing', async () => {
			const { userId, kas, bank, service } = await setup(100_000);
			const made = await transfer(service, userId, kas, bank, 60_000);
			await service.createTransaction(userId, crypto.randomUUID(), {
				type: 'expense',
				amount: 30_000,
				accountId: bank,
				categoryId: null,
				date: '2026-11-21',
				description: 'Biaya admin'
			});

			const refusal = service.reverseTransfer(userId, made.id);
			await expect(refusal).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE', status: 400 });
			await expect(refusal).rejects.toThrow(/Saldo Bank tinggal Rp30\.000/);
			expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([40_000, 30_000]);
			expect(await legsActive(made.sourceTransaction.id, made.destinationTransaction.id)).toEqual([
				true,
				true
			]);
		});

		it('refuses while the destination account is deactivated', async () => {
			const { userId, kas, bank, service } = await setup(100_000);
			const made = await transfer(service, userId, kas, bank, 60_000);
			// Only possible for an account deactivated under the old rule, with money in it.
			await harness.db
				.update(chartOfAccount)
				.set({ isActive: false })
				.where(eq(chartOfAccount.id, bank));

			await expect(service.reverseTransfer(userId, made.id)).rejects.toMatchObject({
				code: 'ACCOUNT_INACTIVE'
			});
			expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([40_000, 60_000]);
		});

		it('never reverses the same transfer twice', async () => {
			const { userId, kas, bank, repository, service } = await setup(100_000);
			const made = await transfer(service, userId, kas, bank, 60_000);
			const reversal = {
				userId,
				amount: 60_000,
				source: { transactionId: made.sourceTransaction.id, accountId: kas },
				destination: { transactionId: made.destinationTransaction.id, accountId: bank }
			};

			// Two requests passed the service's pre-check; only the first may commit.
			await repository.reverseTransferAtomic(reversal);
			await expect(repository.reverseTransferAtomic(reversal)).rejects.toMatchObject({
				code: 'TRANSFER_ALREADY_REVERSED'
			});
			await expect(service.reverseTransfer(userId, made.id)).rejects.toMatchObject({
				code: 'TRANSFER_ALREADY_REVERSED',
				status: 409
			});
			expect([await balanceOf(kas), await balanceOf(bank)]).toEqual([100_000, 0]);
		});

		it("refuses another user's transfer and answers a replay of a reversed one", async () => {
			const owner = await setup(100_000);
			const other = await setup(100_000);
			const made = await transfer(
				owner.service,
				owner.userId,
				owner.kas,
				owner.bank,
				60_000,
				'rev-tf-0001'
			);

			await expect(other.service.reverseTransfer(other.userId, made.id)).rejects.toMatchObject({
				code: 'NOT_FOUND'
			});
			expect([await balanceOf(owner.kas), await balanceOf(owner.bank)]).toEqual([40_000, 60_000]);

			await owner.service.reverseTransfer(owner.userId, made.id);
			await expect(
				transfer(owner.service, owner.userId, owner.kas, owner.bank, 60_000, 'rev-tf-0001')
			).rejects.toMatchObject({ code: 'TRANSFER_REVERSED', status: 409 });
			expect([await balanceOf(owner.kas), await balanceOf(owner.bank)]).toEqual([100_000, 0]);
		});
	});
});

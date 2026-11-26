import { and, eq, gte, ne, sql } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import { batchGuard, isGuardFailure, runBatch } from '$lib/server/db/batch';
import {
	category,
	chartOfAccount,
	debt,
	debtPayment,
	financialCommand,
	transaction
} from '$lib/server/db/schema';
import { FinanceError } from './contracts';

export type AccountRecord = typeof chartOfAccount.$inferSelect;
export type CategoryRecord = typeof category.$inferSelect;
export type TransactionRecord = typeof transaction.$inferSelect & {
	account?: AccountRecord | null;
	category?: CategoryRecord | null;
	toAccount?: AccountRecord | null;
};
export type PaymentRecord = typeof debtPayment.$inferSelect;
export type DebtRecord = typeof debt.$inferSelect & { payments: PaymentRecord[] };
export type CommandRecord = typeof financialCommand.$inferSelect;

export type StoredCommand = {
	id: string;
	userId: string;
	idempotencyKey: string;
	kind: string;
	result: string;
};

export type NewTransaction = typeof transaction.$inferInsert;
export type NewDebt = typeof debt.$inferInsert;
export type NewPayment = typeof debtPayment.$inferInsert;

export interface FinanceRepository {
	findCommand(userId: string, idempotencyKey: string): Promise<CommandRecord | undefined>;
	findAccount(userId: string, accountId: string): Promise<AccountRecord | undefined>;
	findCategory(userId: string, categoryId: string): Promise<CategoryRecord | undefined>;
	findTransaction(userId: string, transactionId: string): Promise<TransactionRecord | undefined>;
	findDebt(userId: string, debtId: string): Promise<DebtRecord | undefined>;
	createTransactionAtomic(
		command: StoredCommand,
		entry: NewTransaction,
		balanceDelta: number
	): Promise<void>;
	updateTransactionAtomic(
		userId: string,
		transactionId: string,
		accountId: string,
		updates: Partial<NewTransaction>,
		balanceDelta: number
	): Promise<void>;
	deleteTransactionAtomic(
		userId: string,
		transactionId: string,
		accountId: string,
		balanceDelta: number
	): Promise<void>;
	createTransferAtomic(input: {
		command: StoredCommand;
		source: NewTransaction;
		destination: NewTransaction;
		amount: number;
	}): Promise<void>;
	createDebtAtomic(command: StoredCommand, entry: NewDebt): Promise<void>;
	updateDebt(userId: string, debtId: string, updates: Partial<NewDebt>): Promise<void>;
	deleteDebt(userId: string, debtId: string): Promise<void>;
	recordDebtPaymentAtomic(input: {
		command: StoredCommand;
		payment: NewPayment;
		entry: NewTransaction;
		balanceDelta: number;
	}): Promise<void>;
}

function adjustBalance(db: SQLiteDb, userId: string, accountId: string, delta: number) {
	return db
		.update(chartOfAccount)
		.set({ balance: sql`${chartOfAccount.balance} + ${delta}` })
		.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
}

/** Explains why a payment batch guard failed, from the debt's state after the abort. */
async function paymentRejection(db: SQLiteDb, userId: string, debtId: string) {
	const [current] = await db
		.select({ remainingAmount: debt.remainingAmount, status: debt.status })
		.from(debt)
		.where(and(eq(debt.userId, userId), eq(debt.id, debtId), eq(debt.isActive, true)));
	if (!current) return new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
	if (current.status === 'paid') {
		return new FinanceError('Hutang/piutang sudah lunas', 400, 'ALREADY_PAID');
	}
	return new FinanceError(
		`Jumlah pembayaran tidak boleh melebihi sisa tagihan (Rp${current.remainingAmount.toLocaleString('id-ID')})`,
		400,
		'OVERPAYMENT'
	);
}

export function createD1FinanceRepository(db: SQLiteDb): FinanceRepository {
	return {
		findCommand(userId, idempotencyKey) {
			return db.query.financialCommand.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.idempotencyKey, idempotencyKey))
			});
		},
		findAccount(userId, accountId) {
			return db.query.chartOfAccount.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.id, accountId), eq(item.isActive, true))
			});
		},
		findCategory(userId, categoryId) {
			return db.query.category.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.id, categoryId), eq(item.isActive, true))
			});
		},
		findTransaction(userId, transactionId) {
			return db.query.transaction.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.id, transactionId), eq(item.isActive, true)),
				with: { account: true, category: true, toAccount: true }
			});
		},
		findDebt(userId, debtId) {
			return db.query.debt.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.id, debtId), eq(item.isActive, true)),
				with: { payments: { orderBy: (payments, { asc }) => [asc(payments.date)] } }
			});
		},
		async createTransactionAtomic(commandRecord, entry, balanceDelta) {
			await runBatch(db, [
				db.insert(financialCommand).values(commandRecord),
				db.insert(transaction).values(entry),
				adjustBalance(db, commandRecord.userId, entry.accountId, balanceDelta)
			]);
		},
		async updateTransactionAtomic(userId, transactionId, accountId, updates, balanceDelta) {
			await runBatch(db, [
				db
					.update(transaction)
					.set(updates)
					.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId))),
				...(balanceDelta !== 0 ? [adjustBalance(db, userId, accountId, balanceDelta)] : [])
			]);
		},
		async deleteTransactionAtomic(userId, transactionId, accountId, balanceDelta) {
			await runBatch(db, [
				db
					.update(transaction)
					.set({ isActive: false })
					.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId))),
				adjustBalance(db, userId, accountId, balanceDelta)
			]);
		},
		async createTransferAtomic({ command: commandRecord, source, destination, amount }) {
			const userId = commandRecord.userId;
			try {
				await runBatch(db, [
					batchGuard(
						db,
						sql`exists (select 1 from ${chartOfAccount} where ${and(
							eq(chartOfAccount.userId, userId),
							eq(chartOfAccount.id, source.accountId),
							eq(chartOfAccount.isActive, true),
							gte(chartOfAccount.balance, amount)
						)})`
					),
					db.insert(financialCommand).values(commandRecord),
					db.insert(transaction).values([source, destination]),
					adjustBalance(db, userId, source.accountId, -amount),
					adjustBalance(db, userId, destination.accountId, amount)
				]);
			} catch (error) {
				if (isGuardFailure(error)) {
					throw new FinanceError('Saldo tidak mencukupi', 400, 'INSUFFICIENT_BALANCE');
				}
				throw error;
			}
		},
		async createDebtAtomic(commandRecord, entry) {
			await runBatch(db, [
				db.insert(financialCommand).values(commandRecord),
				db.insert(debt).values(entry)
			]);
		},
		async updateDebt(userId, debtId, updates) {
			await db
				.update(debt)
				.set(updates)
				.where(and(eq(debt.userId, userId), eq(debt.id, debtId), eq(debt.isActive, true)));
		},
		async deleteDebt(userId, debtId) {
			await db
				.update(debt)
				.set({ isActive: false })
				.where(and(eq(debt.userId, userId), eq(debt.id, debtId), eq(debt.isActive, true)));
		},
		async recordDebtPaymentAtomic({ command: commandRecord, payment, entry, balanceDelta }) {
			const userId = commandRecord.userId;
			try {
				await runBatch(db, [
					batchGuard(
						db,
						sql`exists (select 1 from ${debt} where ${and(
							eq(debt.userId, userId),
							eq(debt.id, payment.debtId),
							eq(debt.isActive, true),
							ne(debt.status, 'paid'),
							gte(debt.remainingAmount, payment.amount)
						)})`
					),
					db.insert(financialCommand).values(commandRecord),
					db.insert(transaction).values(entry),
					adjustBalance(db, userId, payment.accountId, balanceDelta),
					db.insert(debtPayment).values(payment),
					db
						.update(debt)
						.set({
							paidAmount: sql`${debt.paidAmount} + ${payment.amount}`,
							remainingAmount: sql`${debt.remainingAmount} - ${payment.amount}`,
							status: sql`CASE WHEN ${debt.remainingAmount} - ${payment.amount} <= 0 THEN 'paid' ELSE ${debt.status} END`
						})
						.where(and(eq(debt.userId, userId), eq(debt.id, payment.debtId)))
				]);
			} catch (error) {
				if (isGuardFailure(error)) throw await paymentRejection(db, userId, payment.debtId);
				throw error;
			}
		}
	};
}

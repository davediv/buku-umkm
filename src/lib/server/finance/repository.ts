import { and, eq, sql } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
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
			await db.transaction(async (tx) => {
				await tx.insert(financialCommand).values(commandRecord);
				await tx.insert(transaction).values(entry);
				await tx
					.update(chartOfAccount)
					.set({ balance: sql`${chartOfAccount.balance} + ${balanceDelta}` })
					.where(
						and(
							eq(chartOfAccount.userId, commandRecord.userId),
							eq(chartOfAccount.id, entry.accountId)
						)
					);
			});
		},
		async updateTransactionAtomic(userId, transactionId, accountId, updates, balanceDelta) {
			await db.transaction(async (tx) => {
				await tx
					.update(transaction)
					.set(updates)
					.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));
				if (balanceDelta !== 0) {
					await tx
						.update(chartOfAccount)
						.set({ balance: sql`${chartOfAccount.balance} + ${balanceDelta}` })
						.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
				}
			});
		},
		async deleteTransactionAtomic(userId, transactionId, accountId, balanceDelta) {
			await db.transaction(async (tx) => {
				await tx
					.update(transaction)
					.set({ isActive: false })
					.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));
				await tx
					.update(chartOfAccount)
					.set({ balance: sql`${chartOfAccount.balance} + ${balanceDelta}` })
					.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
			});
		},
		async createTransferAtomic({ command: commandRecord, source, destination, amount }) {
			await db.transaction(async (tx) => {
				const [currentSource] = await tx
					.select({ balance: chartOfAccount.balance })
					.from(chartOfAccount)
					.where(
						and(
							eq(chartOfAccount.userId, commandRecord.userId),
							eq(chartOfAccount.id, source.accountId),
							eq(chartOfAccount.isActive, true)
						)
					);
				if (!currentSource || currentSource.balance < amount) {
					throw new FinanceError('Saldo tidak mencukupi', 400, 'INSUFFICIENT_BALANCE');
				}

				await tx.insert(financialCommand).values(commandRecord);
				await tx.insert(transaction).values([source, destination]);
				await tx
					.update(chartOfAccount)
					.set({ balance: sql`${chartOfAccount.balance} - ${amount}` })
					.where(
						and(
							eq(chartOfAccount.userId, commandRecord.userId),
							eq(chartOfAccount.id, source.accountId)
						)
					);
				await tx
					.update(chartOfAccount)
					.set({ balance: sql`${chartOfAccount.balance} + ${amount}` })
					.where(
						and(
							eq(chartOfAccount.userId, commandRecord.userId),
							eq(chartOfAccount.id, destination.accountId)
						)
					);
			});
		},
		async createDebtAtomic(commandRecord, entry) {
			await db.transaction(async (tx) => {
				await tx.insert(financialCommand).values(commandRecord);
				await tx.insert(debt).values(entry);
			});
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
			await db.transaction(async (tx) => {
				const [currentDebt] = await tx
					.select({ remainingAmount: debt.remainingAmount, status: debt.status })
					.from(debt)
					.where(
						and(
							eq(debt.userId, commandRecord.userId),
							eq(debt.id, payment.debtId),
							eq(debt.isActive, true)
						)
					);
				if (!currentDebt)
					throw new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
				if (currentDebt.status === 'paid') {
					throw new FinanceError('Hutang/piutang sudah lunas', 400, 'ALREADY_PAID');
				}
				if (payment.amount > currentDebt.remainingAmount) {
					throw new FinanceError(
						`Jumlah pembayaran tidak boleh melebihi sisa tagihan (Rp${currentDebt.remainingAmount.toLocaleString('id-ID')})`,
						400,
						'OVERPAYMENT'
					);
				}

				await tx.insert(financialCommand).values(commandRecord);
				await tx.insert(transaction).values(entry);
				await tx
					.update(chartOfAccount)
					.set({ balance: sql`${chartOfAccount.balance} + ${balanceDelta}` })
					.where(
						and(
							eq(chartOfAccount.userId, commandRecord.userId),
							eq(chartOfAccount.id, payment.accountId)
						)
					);
				await tx.insert(debtPayment).values(payment);
				await tx
					.update(debt)
					.set({
						paidAmount: sql`${debt.paidAmount} + ${payment.amount}`,
						remainingAmount: sql`${debt.remainingAmount} - ${payment.amount}`,
						status: sql`CASE WHEN ${debt.remainingAmount} - ${payment.amount} <= 0 THEN 'paid' ELSE ${debt.status} END`
					})
					.where(and(eq(debt.userId, commandRecord.userId), eq(debt.id, payment.debtId)));
			});
		}
	};
}

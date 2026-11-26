import { and, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
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
export type NewCategory = typeof category.$inferInsert;

/** The cash movement that pays out or receives a loan's principal. */
export type LoanPrincipal = { entry: NewTransaction; balanceDelta: number };

/**
 * Undoes a cash movement: soft-deletes its transaction and applies `balanceDelta` (the
 * opposite of its original effect) to the account it moved through.
 */
export type MovementReversal = { transactionId: string; accountId: string; balanceDelta: number };

/**
 * One debt payment, written as a whole: its principal reduces what the debt still owes
 * and moves cash with the debt linked; its interest (loans only) is a profit-and-loss
 * transaction of its own. `balanceDelta` is both effects on the payment's account.
 */
export type PaymentRecording = {
	command: StoredCommand;
	payment: NewPayment;
	/** The principal's movement, linked to the debt; null when only interest is paid. */
	principal: NewTransaction | null;
	interest: {
		entry: NewTransaction;
		/** The interest category to create first, when the user does not have it yet. */
		category: NewCategory | null;
	} | null;
	balanceDelta: number;
};

/** Takes back one debt payment, restoring what the debt still owes. */
export type PaymentReversal = {
	userId: string;
	debtId: string;
	paymentId: string;
	/** The principal paid, given back to the debt. */
	amount: number;
	interestAmount: number;
	/** The payment's principal and interest movements that still count in the books. */
	movements: MovementReversal[];
};

/** One side of a transfer: the transaction (leg) and the account it moved money through. */
export type TransferLeg = { transactionId: string; accountId: string };

/** Takes back a transfer: the money returns from the destination to the source. */
export type TransferReversal = {
	userId: string;
	amount: number;
	source: TransferLeg;
	destination: TransferLeg;
};

export interface FinanceRepository {
	findCommand(userId: string, idempotencyKey: string): Promise<CommandRecord | undefined>;
	findAccount(userId: string, accountId: string): Promise<AccountRecord | undefined>;
	findCategory(userId: string, categoryId: string): Promise<CategoryRecord | undefined>;
	findTransaction(userId: string, transactionId: string): Promise<TransactionRecord | undefined>;
	/** The payment whose interest a transaction books, if it is one. */
	findInterestPayment(userId: string, transactionId: string): Promise<PaymentRecord | undefined>;
	/** A system category by type and code, active or not; the oldest if several match. */
	findSystemCategory(
		userId: string,
		type: string,
		code: string
	): Promise<CategoryRecord | undefined>;
	findDebt(userId: string, debtId: string): Promise<DebtRecord | undefined>;
	/** Both legs of a transfer, reversed ones included. */
	findTransferLegs(userId: string, transferId: string): Promise<TransactionRecord[]>;
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
	createDebtAtomic(
		command: StoredCommand,
		entry: NewDebt,
		principal?: LoanPrincipal
	): Promise<void>;
	updateDebt(userId: string, debtId: string, updates: Partial<NewDebt>): Promise<void>;
	deleteDebtAtomic(
		userId: string,
		debtId: string,
		principal: MovementReversal | null
	): Promise<void>;
	recordDebtPaymentAtomic(input: PaymentRecording): Promise<void>;
	reverseDebtPaymentAtomic(input: PaymentReversal): Promise<void>;
	reverseTransferAtomic(input: TransferReversal): Promise<void>;
}

function adjustBalance(db: SQLiteDb, userId: string, accountId: string, delta: number) {
	return db
		.update(chartOfAccount)
		.set({ balance: sql`${chartOfAccount.balance} + ${delta}` })
		.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
}

function softDeleteTransaction(db: SQLiteDb, userId: string, transactionId: string) {
	return db
		.update(transaction)
		.set({ isActive: false })
		.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));
}

function reverseMovement(db: SQLiteDb, userId: string, movement: MovementReversal) {
	return [
		softDeleteTransaction(db, userId, movement.transactionId),
		adjustBalance(db, userId, movement.accountId, movement.balanceDelta)
	];
}

/** SQL condition: the transaction exists for the user and still counts in the books. */
function transactionIsActive(userId: string, transactionId: string) {
	return sql`exists (select 1 from ${transaction} where ${and(
		eq(transaction.userId, userId),
		eq(transaction.id, transactionId),
		eq(transaction.isActive, true)
	)})`;
}

/** Explains why a payment reversal guard failed, from the state after the abort. */
async function paymentReversalRejection(
	db: SQLiteDb,
	{ userId, debtId, paymentId }: PaymentReversal
) {
	const [current] = await db
		.select({ id: debtPayment.id })
		.from(debtPayment)
		.where(
			and(
				eq(debtPayment.userId, userId),
				eq(debtPayment.debtId, debtId),
				eq(debtPayment.id, paymentId)
			)
		);
	if (!current) {
		return new FinanceError(
			'Pembayaran tidak ditemukan atau sudah dibatalkan',
			404,
			'PAYMENT_NOT_FOUND'
		);
	}
	return new FinanceError(
		'Catatan pembayaran berubah saat dibatalkan. Muat ulang halaman, lalu coba lagi.',
		409,
		'PAYMENT_CHANGED'
	);
}

/** Explains why a transfer reversal guard failed, from the state after the abort. */
async function transferReversalRejection(
	db: SQLiteDb,
	{ userId, amount, source, destination }: TransferReversal
) {
	const legs = await db
		.select({ isActive: transaction.isActive })
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				inArray(transaction.id, [source.transactionId, destination.transactionId])
			)
		);
	if (legs.length < 2 || legs.some((leg) => !leg.isActive)) {
		return new FinanceError('Transfer ini sudah dibatalkan', 409, 'TRANSFER_ALREADY_REVERSED');
	}
	const [account] = await db
		.select({
			name: chartOfAccount.name,
			balance: chartOfAccount.balance,
			isActive: chartOfAccount.isActive
		})
		.from(chartOfAccount)
		.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, destination.accountId)));
	if (!account) return new FinanceError('Akun tujuan tidak ditemukan', 404, 'ACCOUNT_NOT_FOUND');
	if (!account.isActive) {
		return new FinanceError(
			`${account.name} sudah dinonaktifkan. Aktifkan kembali akun tersebut di Kas & Rekening sebelum membatalkan transfer.`,
			409,
			'ACCOUNT_INACTIVE'
		);
	}
	return new FinanceError(
		`Saldo ${account.name} tinggal Rp${account.balance.toLocaleString('id-ID')}, kurang dari jumlah transfer (Rp${amount.toLocaleString('id-ID')}). Transfer hanya dapat dibatalkan selama uangnya masih ada di akun tujuan.`,
		400,
		'INSUFFICIENT_BALANCE'
	);
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

/** Explains why a delete batch guard failed, from the debt's state after the abort. */
async function deleteRejection(db: SQLiteDb, userId: string, debtId: string) {
	const [current] = await db
		.select({ id: debt.id })
		.from(debt)
		.where(and(eq(debt.userId, userId), eq(debt.id, debtId), eq(debt.isActive, true)));
	if (!current) return new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
	return new FinanceError(
		'Hutang/piutang yang sudah memiliki pembayaran tidak dapat dihapus',
		409,
		'DEBT_HAS_PAYMENTS'
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
		findInterestPayment(userId, transactionId) {
			return db.query.debtPayment.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.interestTransactionId, transactionId))
			});
		},
		findSystemCategory(userId, type, code) {
			return db.query.category.findFirst({
				where: (item, { eq, and }) =>
					and(
						eq(item.userId, userId),
						eq(item.type, type),
						eq(item.code, code),
						eq(item.isSystem, true)
					),
				orderBy: (item, { asc }) => [asc(item.createdAt), asc(item.id)]
			});
		},
		findDebt(userId, debtId) {
			return db.query.debt.findFirst({
				where: (item, { eq, and }) =>
					and(eq(item.userId, userId), eq(item.id, debtId), eq(item.isActive, true)),
				with: { payments: { orderBy: (payments, { asc }) => [asc(payments.date)] } }
			});
		},
		findTransferLegs(userId, transferId) {
			return db.query.transaction.findMany({
				where: (item, { eq, and }) =>
					and(
						eq(item.userId, userId),
						eq(item.referenceNumber, transferId),
						isNotNull(item.toAccountId)
					),
				with: { account: true, toAccount: true }
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
			await runBatch(db, reverseMovement(db, userId, { transactionId, accountId, balanceDelta }));
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
		async createDebtAtomic(commandRecord, entry, principal) {
			if (!principal) {
				await runBatch(db, [
					db.insert(financialCommand).values(commandRecord),
					db.insert(debt).values(entry)
				]);
				return;
			}

			const userId = commandRecord.userId;
			const accountId = principal.entry.accountId;
			const lending = principal.balanceDelta < 0;
			try {
				await runBatch(db, [
					batchGuard(
						db,
						sql`exists (select 1 from ${chartOfAccount} where ${and(
							eq(chartOfAccount.userId, userId),
							eq(chartOfAccount.id, accountId),
							eq(chartOfAccount.isActive, true),
							lending ? gte(chartOfAccount.balance, -principal.balanceDelta) : undefined
						)})`
					),
					db.insert(financialCommand).values(commandRecord),
					// debt.principalTransactionId and transaction.debtId point at each other, so
					// the debt's link is filled in once both rows exist.
					db.insert(debt).values({ ...entry, principalTransactionId: null }),
					db.insert(transaction).values(principal.entry),
					db
						.update(debt)
						.set({ principalTransactionId: principal.entry.id })
						.where(and(eq(debt.userId, userId), eq(debt.id, entry.id!))),
					adjustBalance(db, userId, accountId, principal.balanceDelta)
				]);
			} catch (error) {
				if (isGuardFailure(error)) {
					throw lending
						? new FinanceError('Saldo tidak mencukupi', 400, 'INSUFFICIENT_BALANCE')
						: new FinanceError('Akun tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
				}
				throw error;
			}
		},
		async updateDebt(userId, debtId, updates) {
			await db
				.update(debt)
				.set(updates)
				.where(and(eq(debt.userId, userId), eq(debt.id, debtId), eq(debt.isActive, true)));
		},
		async deleteDebtAtomic(userId, debtId, principal) {
			try {
				await runBatch(db, [
					// Still active (so a principal is never reversed twice) and still unpaid.
					batchGuard(
						db,
						sql`exists (select 1 from ${debt} where ${and(
							eq(debt.userId, userId),
							eq(debt.id, debtId),
							eq(debt.isActive, true)
						)}) and not exists (select 1 from ${debtPayment} where ${and(
							eq(debtPayment.userId, userId),
							eq(debtPayment.debtId, debtId)
						)})`
					),
					db
						.update(debt)
						.set({ isActive: false })
						.where(and(eq(debt.userId, userId), eq(debt.id, debtId))),
					...(principal ? reverseMovement(db, userId, principal) : [])
				]);
			} catch (error) {
				if (isGuardFailure(error)) throw await deleteRejection(db, userId, debtId);
				throw error;
			}
		},
		async recordDebtPaymentAtomic({
			command: commandRecord,
			payment,
			principal,
			interest,
			balanceDelta
		}) {
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
					...(principal ? [db.insert(transaction).values(principal)] : []),
					// A concurrent first interest payment may have just created the category;
					// it then has the same id (see commands.ts), so this insert is a no-op.
					...(interest?.category
						? [db.insert(category).values(interest.category).onConflictDoNothing()]
						: []),
					...(interest ? [db.insert(transaction).values(interest.entry)] : []),
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
		},
		async reverseDebtPaymentAtomic(reversal) {
			const { userId, debtId, paymentId, amount, interestAmount, movements } = reversal;
			// The payment still exists (so it is never reversed twice), its debt is still
			// recorded, and its movements still count in the books.
			const conditions = [
				sql`exists (select 1 from ${debtPayment} where ${and(
					eq(debtPayment.userId, userId),
					eq(debtPayment.debtId, debtId),
					eq(debtPayment.id, paymentId),
					eq(debtPayment.amount, amount),
					eq(debtPayment.interestAmount, interestAmount)
				)})`,
				sql`exists (select 1 from ${debt} where ${and(
					eq(debt.userId, userId),
					eq(debt.id, debtId),
					eq(debt.isActive, true),
					gte(debt.paidAmount, amount)
				)})`,
				...movements.map((movement) => transactionIsActive(userId, movement.transactionId))
			];
			try {
				await runBatch(db, [
					batchGuard(db, sql.join(conditions, sql` and `)),
					db
						.delete(debtPayment)
						.where(and(eq(debtPayment.userId, userId), eq(debtPayment.id, paymentId))),
					...movements.flatMap((movement) => reverseMovement(db, userId, movement)),
					db
						.update(debt)
						.set({
							paidAmount: sql`${debt.paidAmount} - ${amount}`,
							remainingAmount: sql`${debt.remainingAmount} + ${amount}`,
							status: sql`CASE WHEN ${debt.status} = 'paid' THEN 'active' ELSE ${debt.status} END`
						})
						.where(and(eq(debt.userId, userId), eq(debt.id, debtId)))
				]);
			} catch (error) {
				if (isGuardFailure(error)) throw await paymentReversalRejection(db, reversal);
				throw error;
			}
		},
		async reverseTransferAtomic(reversal) {
			const { userId, amount, source, destination } = reversal;
			try {
				await runBatch(db, [
					// Both legs still count (so a transfer is never reversed twice) and, as when
					// the transfer was made, the account the money now leaves can cover it.
					batchGuard(
						db,
						sql`${transactionIsActive(userId, source.transactionId)} and ${transactionIsActive(
							userId,
							destination.transactionId
						)} and exists (select 1 from ${chartOfAccount} where ${and(
							eq(chartOfAccount.userId, userId),
							eq(chartOfAccount.id, destination.accountId),
							eq(chartOfAccount.isActive, true),
							gte(chartOfAccount.balance, amount)
						)})`
					),
					softDeleteTransaction(db, userId, source.transactionId),
					softDeleteTransaction(db, userId, destination.transactionId),
					adjustBalance(db, userId, destination.accountId, -amount),
					adjustBalance(db, userId, source.accountId, amount)
				]);
			} catch (error) {
				if (isGuardFailure(error)) throw await transferReversalRejection(db, reversal);
				throw error;
			}
		}
	};
}

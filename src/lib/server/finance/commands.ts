import type {
	CreateDebtCommand,
	CreateTransactionCommand,
	CreateTransferCommand,
	RecordDebtPaymentCommand,
	UpdateDebtCommand,
	UpdateTransactionCommand
} from './contracts';
import { FinanceError } from './contracts';
import type {
	AccountRecord,
	DebtRecord,
	FinanceRepository,
	LoanPrincipal,
	MovementReversal,
	NewCategory,
	PaymentRecord,
	StoredCommand,
	TransactionRecord
} from './repository';
import {
	LOAN_INTEREST_CATEGORIES,
	loanInterestDescription,
	type InterestType
} from '#lib/debts/interest.ts';

type CommandKind = 'transaction.create' | 'transfer.create' | 'debt.create' | 'debt.payment';

type MutationOutcome<T> = { entity: T; replayed: boolean };

export type TransferRecord = {
	id: string;
	date: string;
	amount: number;
	description: string | null;
	sourceAccount: AccountRecord;
	destinationAccount: AccountRecord;
	sourceTransaction: TransactionRecord;
	destinationTransaction: TransactionRecord;
};

export type DebtPaymentOutcome = {
	debt: DebtRecord;
	payment: PaymentRecord;
	/** The principal's movement; null for a loan payment of interest alone. */
	transaction: TransactionRecord | null;
	/** The interest's profit-and-loss transaction; null when the payment has no interest. */
	interestTransaction: TransactionRecord | null;
};

/**
 * What a debt payment command stores. Commands stored before loan interest existed have
 * a principal transaction always and no interestTransactionId.
 */
type PaymentIds = {
	debtId: string;
	paymentId: string;
	transactionId: string | null;
	interestTransactionId?: string | null;
};

function parseStoredResult<T>(stored: { kind: string; result: string }, kind: CommandKind): T {
	if (stored.kind !== kind) {
		throw new FinanceError(
			'Kunci permintaan sudah digunakan untuk operasi lain',
			409,
			'IDEMPOTENCY_KEY_REUSED'
		);
	}
	try {
		return JSON.parse(stored.result) as T;
	} catch {
		throw new FinanceError('Hasil operasi sebelumnya tidak valid', 500, 'CORRUPT_COMMAND');
	}
}

function storedCommand(
	createId: () => string,
	userId: string,
	idempotencyKey: string,
	kind: CommandKind,
	result: object
): StoredCommand {
	return {
		id: createId(),
		userId,
		idempotencyKey,
		kind,
		result: JSON.stringify(result)
	};
}

function balanceEffect(type: string, amount: number): number {
	return type === 'income' ? amount : -amount;
}

function requirePersisted<T>(entity: T | undefined, message: string): T {
	if (!entity) throw new FinanceError(message, 500, 'PERSISTENCE_ERROR');
	return entity;
}

function requireStandaloneTransaction(
	entity: TransactionRecord,
	interestOf: PaymentRecord | undefined
): void {
	if (entity.debtId) {
		throw new FinanceError(
			'Transaksi yang terhubung ke hutang/piutang tidak dapat diubah terpisah dari catatannya',
			409,
			'LINKED_TRANSACTION'
		);
	}
	if (entity.toAccountId) {
		throw new FinanceError(
			'Transaksi transfer tidak dapat diubah terpisah dari pasangan transfernya',
			409,
			'LINKED_TRANSACTION'
		);
	}
	if (interestOf) {
		throw new FinanceError(
			'Bunga ini tercatat dari pembayaran pinjaman. Untuk mengoreksinya, batalkan pembayaran tersebut di catatan pinjamannya.',
			409,
			'LINKED_TRANSACTION'
		);
	}
}

/** Undoes a movement that still counts in the books: the opposite of its balance effect. */
function reversalOf(movement: TransactionRecord): MovementReversal {
	return {
		transactionId: movement.id,
		accountId: movement.accountId,
		balanceDelta: -balanceEffect(movement.type, movement.amount)
	};
}

/**
 * The id a user's loan interest category gets when their first interest payment creates
 * it. It is fixed per user and side, so two first payments racing each other create one
 * category (the second insert is ignored) and both book under it. A category restored
 * from a backup has a fresh id instead, which findSystemCategory finds by code first.
 */
function interestCategoryId(userId: string, type: InterestType): string {
	return `loan-interest-${type}-${userId}`;
}

function requireAccountOpenOn(account: AccountRecord, date: string): void {
	if (account.openingDate && date < account.openingDate) {
		throw new FinanceError(
			`Tanggal tidak boleh sebelum tanggal saldo awal akun (${account.openingDate})`,
			400,
			'DATE_BEFORE_ACCOUNT_OPENING'
		);
	}
}

function paymentDescription(item: DebtRecord): string {
	if (item.kind === 'loan') {
		return item.type === 'piutang'
			? `Pengembalian pinjaman dari ${item.contactName}`
			: `Pembayaran pinjaman ke ${item.contactName}`;
	}
	return item.type === 'piutang'
		? `Pembayaran piutang dari ${item.contactName}`
		: `Pembayaran hutang ke ${item.contactName}`;
}

export function createFinancialMutationService(
	repository: FinanceRepository,
	createId: () => string = () => crypto.randomUUID()
) {
	async function replayTransaction(
		userId: string,
		idempotencyKey: string
	): Promise<MutationOutcome<TransactionRecord> | null> {
		const stored = await repository.findCommand(userId, idempotencyKey);
		if (!stored) return null;
		const result = parseStoredResult<{ transactionId: string }>(stored, 'transaction.create');
		const entity = requirePersisted(
			await repository.findTransaction(userId, result.transactionId),
			'Transaksi dari permintaan sebelumnya tidak tersedia'
		);
		return { entity, replayed: true };
	}

	async function createTransaction(
		userId: string,
		idempotencyKey: string,
		input: CreateTransactionCommand
	): Promise<MutationOutcome<TransactionRecord>> {
		const replay = await replayTransaction(userId, idempotencyKey);
		if (replay) return replay;

		const [account, selectedCategory] = await Promise.all([
			repository.findAccount(userId, input.accountId),
			input.categoryId ? repository.findCategory(userId, input.categoryId) : undefined
		]);
		if (!account) throw new FinanceError('Akun tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
		requireAccountOpenOn(account, input.date);
		if (input.categoryId && !selectedCategory) {
			throw new FinanceError('Kategori tidak ditemukan', 400, 'CATEGORY_NOT_FOUND');
		}
		if (selectedCategory && selectedCategory.type !== input.type) {
			throw new FinanceError(
				`Kategori harus bertipe "${input.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}"`,
				400,
				'CATEGORY_TYPE_MISMATCH'
			);
		}

		const transactionId = createId();
		const command = storedCommand(createId, userId, idempotencyKey, 'transaction.create', {
			transactionId
		});
		try {
			await repository.createTransactionAtomic(
				command,
				{
					id: transactionId,
					userId,
					date: input.date,
					type: input.type,
					amount: input.amount,
					description: input.description,
					referenceNumber: input.referenceNumber ?? null,
					notes: input.notes ?? null,
					accountId: input.accountId,
					categoryId: input.categoryId,
					toAccountId: null
				},
				balanceEffect(input.type, input.amount)
			);
		} catch (error) {
			const concurrentReplay = await replayTransaction(userId, idempotencyKey);
			if (concurrentReplay) return concurrentReplay;
			throw error;
		}

		return {
			entity: requirePersisted(
				await repository.findTransaction(userId, transactionId),
				'Transaksi gagal dimuat setelah disimpan'
			),
			replayed: false
		};
	}

	async function findStandaloneTransaction(
		userId: string,
		transactionId: string
	): Promise<TransactionRecord> {
		const [existing, interestOf] = await Promise.all([
			repository.findTransaction(userId, transactionId),
			repository.findInterestPayment(userId, transactionId)
		]);
		if (!existing) throw new FinanceError('Transaksi tidak ditemukan', 404, 'NOT_FOUND');
		requireStandaloneTransaction(existing, interestOf);
		return existing;
	}

	async function updateTransaction(
		userId: string,
		transactionId: string,
		input: UpdateTransactionCommand
	): Promise<TransactionRecord> {
		const existing = await findStandaloneTransaction(userId, transactionId);
		if (input.date !== undefined) {
			const account =
				existing.account ?? (await repository.findAccount(userId, existing.accountId));
			if (!account) throw new FinanceError('Akun tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
			requireAccountOpenOn(account, input.date);
		}

		if (input.categoryId) {
			const selectedCategory = await repository.findCategory(userId, input.categoryId);
			if (!selectedCategory) {
				throw new FinanceError('Kategori tidak ditemukan', 400, 'CATEGORY_NOT_FOUND');
			}
			if (selectedCategory.type !== existing.type) {
				throw new FinanceError(
					`Kategori harus bertipe "${existing.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}"`,
					400,
					'CATEGORY_TYPE_MISMATCH'
				);
			}
		}

		const nextAmount = input.amount ?? existing.amount;
		const balanceDelta =
			balanceEffect(existing.type, nextAmount) - balanceEffect(existing.type, existing.amount);
		await repository.updateTransactionAtomic(
			userId,
			transactionId,
			existing.accountId,
			{
				...(input.amount !== undefined ? { amount: input.amount } : {}),
				...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
				...(input.date !== undefined ? { date: input.date } : {}),
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
				...(input.notes !== undefined ? { notes: input.notes } : {})
			},
			balanceDelta
		);

		return requirePersisted(
			await repository.findTransaction(userId, transactionId),
			'Transaksi gagal dimuat setelah diperbarui'
		);
	}

	async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
		const existing = await findStandaloneTransaction(userId, transactionId);
		await repository.deleteTransactionAtomic(
			userId,
			transactionId,
			existing.accountId,
			-balanceEffect(existing.type, existing.amount)
		);
	}

	async function replayTransfer(
		userId: string,
		idempotencyKey: string
	): Promise<MutationOutcome<TransferRecord> | null> {
		const stored = await repository.findCommand(userId, idempotencyKey);
		if (!stored) return null;
		const result = parseStoredResult<{
			transferId: string;
			sourceTransactionId: string;
			destinationTransactionId: string;
		}>(stored, 'transfer.create');
		const [source, destination] = await Promise.all([
			repository.findTransaction(userId, result.sourceTransactionId),
			repository.findTransaction(userId, result.destinationTransactionId)
		]);
		if (!source || !destination) {
			throw new FinanceError(
				'Transfer dari permintaan ini sudah dibatalkan',
				409,
				'TRANSFER_REVERSED'
			);
		}
		const [sourceAccount, destinationAccount] = await Promise.all([
			repository.findAccount(userId, source.accountId),
			repository.findAccount(userId, destination.accountId)
		]);
		return {
			entity: {
				id: result.transferId,
				date: source.date,
				amount: source.amount,
				description: source.description,
				sourceAccount: requirePersisted(sourceAccount, 'Akun sumber transfer tidak tersedia'),
				destinationAccount: requirePersisted(
					destinationAccount,
					'Akun tujuan transfer tidak tersedia'
				),
				sourceTransaction: source,
				destinationTransaction: destination
			},
			replayed: true
		};
	}

	async function createTransfer(
		userId: string,
		idempotencyKey: string,
		input: CreateTransferCommand
	): Promise<MutationOutcome<TransferRecord>> {
		const replay = await replayTransfer(userId, idempotencyKey);
		if (replay) return replay;
		const [sourceAccount, destinationAccount] = await Promise.all([
			repository.findAccount(userId, input.sourceAccountId),
			repository.findAccount(userId, input.destinationAccountId)
		]);
		if (!sourceAccount)
			throw new FinanceError('Akun sumber tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
		if (!destinationAccount) {
			throw new FinanceError('Akun tujuan tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
		}
		requireAccountOpenOn(sourceAccount, input.date);
		requireAccountOpenOn(destinationAccount, input.date);

		const transferId = createId();
		const sourceTransactionId = createId();
		const destinationTransactionId = createId();
		const sourceDescription = input.description ?? `Transfer ke ${destinationAccount.name}`;
		const destinationDescription = input.description ?? `Transfer dari ${sourceAccount.name}`;
		const command = storedCommand(createId, userId, idempotencyKey, 'transfer.create', {
			transferId,
			sourceTransactionId,
			destinationTransactionId
		});
		try {
			await repository.createTransferAtomic({
				command,
				amount: input.amount,
				source: {
					id: sourceTransactionId,
					userId,
					date: input.date,
					type: 'expense',
					amount: input.amount,
					description: sourceDescription,
					accountId: sourceAccount.id,
					toAccountId: destinationAccount.id,
					categoryId: null,
					referenceNumber: transferId
				},
				destination: {
					id: destinationTransactionId,
					userId,
					date: input.date,
					type: 'income',
					amount: input.amount,
					description: destinationDescription,
					accountId: destinationAccount.id,
					toAccountId: sourceAccount.id,
					categoryId: null,
					referenceNumber: transferId
				}
			});
		} catch (error) {
			const concurrentReplay = await replayTransfer(userId, idempotencyKey);
			if (concurrentReplay) return concurrentReplay;
			throw error;
		}

		const [sourceTransaction, destinationTransaction] = await Promise.all([
			repository.findTransaction(userId, sourceTransactionId),
			repository.findTransaction(userId, destinationTransactionId)
		]);
		return {
			entity: {
				id: transferId,
				date: input.date,
				amount: input.amount,
				description: input.description,
				sourceAccount,
				destinationAccount,
				sourceTransaction: requirePersisted(sourceTransaction, 'Transfer gagal dimuat'),
				destinationTransaction: requirePersisted(destinationTransaction, 'Transfer gagal dimuat')
			},
			replayed: false
		};
	}

	/**
	 * Takes back a transfer made by mistake: soft-deletes both legs and moves the money
	 * from the destination back to the source. Like the transfer itself, it needs the
	 * account the money leaves (now the destination) to still hold the amount.
	 */
	async function reverseTransfer(userId: string, transferId: string): Promise<void> {
		const legs = await repository.findTransferLegs(userId, transferId);
		const source = legs.find((leg) => leg.type === 'expense');
		const destination = legs.find((leg) => leg.type === 'income');
		if (
			legs.length !== 2 ||
			!source ||
			!destination ||
			source.toAccountId !== destination.accountId ||
			destination.toAccountId !== source.accountId ||
			source.amount !== destination.amount
		) {
			throw new FinanceError('Transfer tidak ditemukan', 404, 'NOT_FOUND');
		}
		if (!source.isActive || !destination.isActive) {
			throw new FinanceError('Transfer ini sudah dibatalkan', 409, 'TRANSFER_ALREADY_REVERSED');
		}
		await repository.reverseTransferAtomic({
			userId,
			amount: source.amount,
			source: { transactionId: source.id, accountId: source.accountId },
			destination: { transactionId: destination.id, accountId: destination.accountId }
		});
	}

	async function replayDebt(
		userId: string,
		idempotencyKey: string
	): Promise<MutationOutcome<DebtRecord> | null> {
		const stored = await repository.findCommand(userId, idempotencyKey);
		if (!stored) return null;
		const result = parseStoredResult<{ debtId: string }>(stored, 'debt.create');
		return {
			entity: requirePersisted(
				await repository.findDebt(userId, result.debtId),
				'Hutang/piutang dari permintaan sebelumnya tidak tersedia'
			),
			replayed: true
		};
	}

	/**
	 * A loan moves its principal when it is recorded: borrowed money (hutang) comes into
	 * the account, lent money (piutang) leaves it. The movement is linked to the debt, so
	 * it changes the balance without counting as revenue or expense.
	 */
	async function loanPrincipal(
		userId: string,
		debtId: string,
		input: CreateDebtCommand
	): Promise<LoanPrincipal> {
		const account = input.accountId
			? await repository.findAccount(userId, input.accountId)
			: undefined;
		if (!account) throw new FinanceError('Akun tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
		requireAccountOpenOn(account, input.date);
		const type = input.type === 'hutang' ? 'income' : 'expense';
		return {
			balanceDelta: balanceEffect(type, input.originalAmount),
			entry: {
				id: createId(),
				userId,
				date: input.date,
				type,
				amount: input.originalAmount,
				description:
					input.type === 'hutang'
						? `Pinjaman diterima dari ${input.contactName}`
						: `Pinjaman diberikan ke ${input.contactName}`,
				accountId: account.id,
				categoryId: null,
				toAccountId: null,
				debtId
			}
		};
	}

	async function createDebt(
		userId: string,
		idempotencyKey: string,
		input: CreateDebtCommand
	): Promise<MutationOutcome<DebtRecord>> {
		const replay = await replayDebt(userId, idempotencyKey);
		if (replay) return replay;
		const debtId = createId();
		const principal =
			input.kind === 'loan' ? await loanPrincipal(userId, debtId, input) : undefined;
		const command = storedCommand(createId, userId, idempotencyKey, 'debt.create', { debtId });
		try {
			await repository.createDebtAtomic(
				command,
				{
					id: debtId,
					userId,
					type: input.type,
					kind: input.kind,
					principalAccountId: principal?.entry.accountId ?? null,
					principalTransactionId: principal?.entry.id ?? null,
					contactName: input.contactName,
					contactPhone: input.contactPhone,
					contactAddress: input.contactAddress,
					originalAmount: input.originalAmount,
					paidAmount: 0,
					remainingAmount: input.originalAmount,
					date: input.date,
					dueDate: input.dueDate,
					description: input.description,
					status: 'active',
					isActive: true
				},
				principal
			);
		} catch (error) {
			const concurrentReplay = await replayDebt(userId, idempotencyKey);
			if (concurrentReplay) return concurrentReplay;
			throw error;
		}

		return {
			entity: requirePersisted(
				await repository.findDebt(userId, debtId),
				'Hutang/piutang gagal dimuat setelah disimpan'
			),
			replayed: false
		};
	}

	async function updateDebt(
		userId: string,
		debtId: string,
		input: UpdateDebtCommand
	): Promise<DebtRecord> {
		const existing = await repository.findDebt(userId, debtId);
		if (!existing) throw new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
		if (input.dueDate && input.dueDate < existing.date) {
			throw new FinanceError('Tanggal jatuh tempo tidak boleh sebelum tanggal pencatatan');
		}
		await repository.updateDebt(userId, debtId, {
			...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
			...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
			...(input.contactAddress !== undefined ? { contactAddress: input.contactAddress } : {}),
			...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
			...(input.description !== undefined ? { description: input.description } : {})
		});
		return requirePersisted(
			await repository.findDebt(userId, debtId),
			'Hutang/piutang gagal dimuat setelah diperbarui'
		);
	}

	async function deleteDebt(userId: string, debtId: string): Promise<void> {
		const existing = await repository.findDebt(userId, debtId);
		if (!existing) throw new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
		if (existing.payments.length > 0) {
			throw new FinanceError(
				'Hutang/piutang yang sudah memiliki pembayaran tidak dapat dihapus',
				409,
				'DEBT_HAS_PAYMENTS'
			);
		}
		// Deleting a loan also takes back the principal it moved.
		const movement = existing.principalTransactionId
			? await repository.findTransaction(userId, existing.principalTransactionId)
			: undefined;
		await repository.deleteDebtAtomic(userId, debtId, movement ? reversalOf(movement) : null);
	}

	/**
	 * The debt, payment and movements a payment command wrote. A replayed request whose
	 * payment has since been reversed is refused rather than answered with a stale result.
	 */
	async function loadPaymentOutcome(
		userId: string,
		ids: PaymentIds,
		replayed: boolean
	): Promise<DebtPaymentOutcome> {
		const missing = replayed
			? 'Pembayaran sebelumnya tidak tersedia'
			: 'Pembayaran gagal dimuat setelah disimpan';
		const [found, principal, interest] = await Promise.all([
			repository.findDebt(userId, ids.debtId),
			ids.transactionId ? repository.findTransaction(userId, ids.transactionId) : undefined,
			ids.interestTransactionId
				? repository.findTransaction(userId, ids.interestTransactionId)
				: undefined
		]);
		const canonicalDebt = requirePersisted(found, missing);
		const payment = canonicalDebt.payments.find((item) => item.id === ids.paymentId);
		if (!payment && replayed) {
			throw new FinanceError(
				'Pembayaran dari permintaan ini sudah dibatalkan',
				409,
				'PAYMENT_REVERSED'
			);
		}
		return {
			debt: canonicalDebt,
			payment: requirePersisted(payment, missing),
			transaction: ids.transactionId ? requirePersisted(principal, missing) : null,
			interestTransaction: ids.interestTransactionId ? requirePersisted(interest, missing) : null
		};
	}

	async function replayDebtPayment(
		userId: string,
		idempotencyKey: string
	): Promise<MutationOutcome<DebtPaymentOutcome> | null> {
		const stored = await repository.findCommand(userId, idempotencyKey);
		if (!stored) return null;
		const ids = parseStoredResult<PaymentIds>(stored, 'debt.payment');
		return { entity: await loadPaymentOutcome(userId, ids, true), replayed: true };
	}

	/**
	 * The system category loan interest of one side is booked under: the user's own, or a
	 * new one for the payment's batch to create.
	 */
	async function interestCategory(
		userId: string,
		type: InterestType
	): Promise<{ id: string; create: NewCategory | null }> {
		const definition = LOAN_INTEREST_CATEGORIES[type];
		const existing = await repository.findSystemCategory(userId, type, definition.code);
		if (existing) return { id: existing.id, create: null };
		const id = interestCategoryId(userId, type);
		return {
			id,
			create: {
				id,
				userId,
				code: definition.code,
				name: definition.name,
				type,
				isSystem: true,
				isActive: true,
				icon: definition.icon,
				color: definition.color
			}
		};
	}

	/**
	 * Records one payment. `amount` is the principal: it reduces what the debt still owes
	 * and moves cash with the debt linked, so it is never revenue or expense. A loan payment
	 * may also carry interest, booked as its own transaction without the debt link (an
	 * expense on a loan received, income on a loan given) on the same date and account. A
	 * payment of interest alone (principal 0) is allowed while the loan is still open, as
	 * monthly interest on an informal loan often is: only through the loan is a lender's
	 * interest kept out of PPh Final turnover. Everything is written in one batch.
	 */
	async function recordDebtPayment(
		userId: string,
		debtId: string,
		idempotencyKey: string,
		input: RecordDebtPaymentCommand
	): Promise<MutationOutcome<DebtPaymentOutcome>> {
		const replay = await replayDebtPayment(userId, idempotencyKey);
		if (replay) return replay;
		const [existingDebt, account] = await Promise.all([
			repository.findDebt(userId, debtId),
			repository.findAccount(userId, input.accountId)
		]);
		if (!existingDebt) throw new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
		if (!account) throw new FinanceError('Akun tidak ditemukan', 400, 'ACCOUNT_NOT_FOUND');
		if (input.date < existingDebt.date) {
			throw new FinanceError(
				'Tanggal pembayaran tidak boleh sebelum tanggal pencatatan hutang/piutang',
				400,
				'PAYMENT_BEFORE_DEBT'
			);
		}
		requireAccountOpenOn(account, input.date);
		if (existingDebt.status === 'paid') {
			throw new FinanceError('Hutang/piutang sudah lunas', 400, 'ALREADY_PAID');
		}
		const interestAmount = input.interestAmount ?? 0;
		if (interestAmount > 0 && existingDebt.kind !== 'loan') {
			throw new FinanceError(
				'Bunga hanya dapat dicatat pada pembayaran pinjaman',
				400,
				'INTEREST_NOT_ALLOWED'
			);
		}
		if (input.amount <= 0 && interestAmount <= 0) {
			throw new FinanceError('Jumlah pembayaran harus lebih dari 0');
		}
		if (input.amount > existingDebt.remainingAmount) {
			throw new FinanceError(
				`Jumlah pembayaran tidak boleh melebihi sisa tagihan (Rp${existingDebt.remainingAmount.toLocaleString('id-ID')})`,
				400,
				'OVERPAYMENT'
			);
		}

		// Both parts move money the same way: in on a receivable, out on a payable. That is
		// also the side interest falls on: income on a loan given, expense on one received.
		const transactionType = existingDebt.type === 'piutang' ? 'income' : 'expense';
		const ids: PaymentIds = {
			debtId,
			paymentId: createId(),
			transactionId: input.amount > 0 ? createId() : null,
			interestTransactionId: interestAmount > 0 ? createId() : null
		};
		const category = ids.interestTransactionId
			? await interestCategory(userId, transactionType)
			: null;
		const movement = { userId, date: input.date, accountId: input.accountId, toAccountId: null };
		const command = storedCommand(createId, userId, idempotencyKey, 'debt.payment', ids);
		try {
			await repository.recordDebtPaymentAtomic({
				command,
				balanceDelta: balanceEffect(transactionType, input.amount + interestAmount),
				principal: ids.transactionId
					? {
							...movement,
							id: ids.transactionId,
							type: transactionType,
							amount: input.amount,
							description: paymentDescription(existingDebt),
							categoryId: null,
							debtId
						}
					: null,
				interest:
					ids.interestTransactionId && category
						? {
								entry: {
									...movement,
									id: ids.interestTransactionId,
									type: transactionType,
									amount: interestAmount,
									description: loanInterestDescription(existingDebt.type, existingDebt.contactName),
									categoryId: category.id,
									// No debt link: interest is revenue or expense (ledger.ts).
									debtId: null
								},
								category: category.create
							}
						: null,
				payment: {
					id: ids.paymentId,
					debtId,
					userId,
					amount: input.amount,
					interestAmount,
					date: input.date,
					accountId: input.accountId,
					transactionId: ids.transactionId,
					interestTransactionId: ids.interestTransactionId ?? null,
					notes: input.notes
				}
			});
		} catch (error) {
			const concurrentReplay = await replayDebtPayment(userId, idempotencyKey);
			if (concurrentReplay) return concurrentReplay;
			throw error;
		}

		return { entity: await loadPaymentOutcome(userId, ids, false), replayed: false };
	}

	/**
	 * Takes back a payment recorded by mistake: removes it from the debt's history,
	 * soft-deletes its principal and interest transactions, reverses both balance effects
	 * and reopens the debt, all in one batch. Loan interest leaves the income statement
	 * with it; trade debts keep their revenue or expense, recognised on the debt date.
	 */
	async function reverseDebtPayment(
		userId: string,
		debtId: string,
		paymentId: string
	): Promise<DebtRecord> {
		const existing = await repository.findDebt(userId, debtId);
		if (!existing) throw new FinanceError('Hutang/piutang tidak ditemukan', 404, 'NOT_FOUND');
		const payment = existing.payments.find((item) => item.id === paymentId);
		if (!payment) {
			throw new FinanceError(
				'Pembayaran tidak ditemukan atau sudah dibatalkan',
				404,
				'PAYMENT_NOT_FOUND'
			);
		}
		// Only a movement that still counts in the books has a balance effect to undo.
		const movements = await Promise.all(
			[payment.transactionId, payment.interestTransactionId].map((id) =>
				id ? repository.findTransaction(userId, id) : undefined
			)
		);
		await repository.reverseDebtPaymentAtomic({
			userId,
			debtId,
			paymentId,
			amount: payment.amount,
			interestAmount: payment.interestAmount,
			movements: movements
				.filter((item): item is TransactionRecord => item !== undefined)
				.map(reversalOf)
		});
		return requirePersisted(
			await repository.findDebt(userId, debtId),
			'Hutang/piutang gagal dimuat setelah pembayaran dibatalkan'
		);
	}

	return {
		createTransaction,
		updateTransaction,
		deleteTransaction,
		createTransfer,
		reverseTransfer,
		createDebt,
		updateDebt,
		deleteDebt,
		recordDebtPayment,
		reverseDebtPayment
	};
}

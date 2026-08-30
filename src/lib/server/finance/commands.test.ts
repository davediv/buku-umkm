import { describe, expect, it, vi } from 'vitest';
import { createFinancialMutationService } from './commands';
import { FinanceError } from './contracts';
import type {
	AccountRecord,
	CategoryRecord,
	CommandRecord,
	DebtRecord,
	FinanceRepository,
	NewTransaction,
	TransactionRecord
} from './repository';

const now = new Date('2026-08-30T08:00:00.000Z');

function account(id: string, userId: string, balance = 1_000_000): AccountRecord {
	return {
		id,
		userId,
		code: '1101',
		name: 'Kas',
		type: 'asset',
		subType: 'kas',
		isSystem: false,
		isActive: true,
		parentId: null,
		balance,
		openingBalance: balance,
		openingDate: '2026-01-01',
		createdAt: now,
		updatedAt: now
	};
}

function persistedTransaction(entry: NewTransaction): TransactionRecord {
	return {
		id: entry.id!,
		userId: entry.userId,
		date: entry.date,
		type: entry.type,
		amount: entry.amount,
		description: entry.description ?? null,
		accountId: entry.accountId,
		toAccountId: entry.toAccountId ?? null,
		categoryId: entry.categoryId ?? null,
		debtId: entry.debtId ?? null,
		isTaxed: entry.isTaxed ?? false,
		taxAmount: entry.taxAmount ?? 0,
		referenceNumber: entry.referenceNumber ?? null,
		notes: entry.notes ?? null,
		isActive: entry.isActive ?? true,
		createdAt: now,
		updatedAt: now
	};
}

function createRepository() {
	const accounts = new Map([
		['account-1', account('account-1', 'user-1')],
		['foreign-account', account('foreign-account', 'user-2')]
	]);
	const categories = new Map<string, CategoryRecord>();
	const transactions = new Map<string, TransactionRecord>();
	const debts = new Map<string, DebtRecord>();
	const commands = new Map<string, CommandRecord>();

	const repository = {
		findCommand: vi.fn(async (userId: string, key: string) => commands.get(`${userId}:${key}`)),
		findAccount: vi.fn(async (userId: string, id: string) => {
			const item = accounts.get(id);
			return item?.userId === userId ? item : undefined;
		}),
		findCategory: vi.fn(async (userId: string, id: string) => {
			const item = categories.get(id);
			return item?.userId === userId ? item : undefined;
		}),
		findTransaction: vi.fn(async (userId: string, id: string) => {
			const item = transactions.get(id);
			return item?.userId === userId && item.isActive ? item : undefined;
		}),
		findDebt: vi.fn(async (userId: string, id: string) => {
			const item = debts.get(id);
			return item?.userId === userId && item.isActive ? item : undefined;
		}),
		createTransactionAtomic: vi.fn(async (command, entry, balanceDelta) => {
			commands.set(`${command.userId}:${command.idempotencyKey}`, { ...command, createdAt: now });
			transactions.set(entry.id!, persistedTransaction(entry));
			const target = accounts.get(entry.accountId)!;
			target.balance += balanceDelta;
		}),
		updateTransactionAtomic: vi.fn(async (userId, id, accountId, updates, balanceDelta) => {
			const item = transactions.get(id)!;
			transactions.set(id, { ...item, ...updates, updatedAt: now });
			accounts.get(accountId)!.balance += balanceDelta;
		}),
		deleteTransactionAtomic: vi.fn(async (_userId, id, accountId, balanceDelta) => {
			transactions.get(id)!.isActive = false;
			accounts.get(accountId)!.balance += balanceDelta;
		}),
		createTransferAtomic: vi.fn(),
		createDebtAtomic: vi.fn(async (command, entry) => {
			commands.set(`${command.userId}:${command.idempotencyKey}`, { ...command, createdAt: now });
			debts.set(entry.id!, {
				id: entry.id!,
				userId: entry.userId,
				type: entry.type,
				contactName: entry.contactName,
				contactPhone: entry.contactPhone ?? null,
				contactAddress: entry.contactAddress ?? null,
				originalAmount: entry.originalAmount,
				paidAmount: entry.paidAmount ?? 0,
				remainingAmount: entry.remainingAmount,
				date: entry.date,
				dueDate: entry.dueDate ?? null,
				description: entry.description ?? null,
				status: entry.status ?? 'active',
				isActive: entry.isActive ?? true,
				createdAt: now,
				updatedAt: now,
				payments: []
			});
		}),
		updateDebt: vi.fn(),
		deleteDebt: vi.fn(),
		recordDebtPaymentAtomic: vi.fn()
	} satisfies FinanceRepository;

	return { repository, accounts, transactions, debts };
}

function ids(...values: string[]) {
	const next = vi.fn();
	for (const value of values) next.mockReturnValueOnce(value);
	return next;
}

describe('financial mutation commands', () => {
	it('creates one canonical transaction and replays the same command without another balance effect', async () => {
		const { repository, accounts } = createRepository();
		const service = createFinancialMutationService(repository, ids('txn-1', 'command-1'));
		const input = {
			type: 'income' as const,
			amount: 250_000,
			accountId: 'account-1',
			categoryId: null,
			date: '2026-08-30',
			description: 'Penjualan'
		};

		const created = await service.createTransaction('user-1', 'request-123', input);
		const replayed = await service.createTransaction('user-1', 'request-123', input);

		expect(created.entity.id).toBe('txn-1');
		expect(created.replayed).toBe(false);
		expect(replayed).toMatchObject({ entity: { id: 'txn-1' }, replayed: true });
		expect(repository.createTransactionAtomic).toHaveBeenCalledTimes(1);
		expect(accounts.get('account-1')?.balance).toBe(1_250_000);
	});

	it('rejects an account owned by another user before writing anything', async () => {
		const { repository } = createRepository();
		const service = createFinancialMutationService(repository, ids('txn-1', 'command-1'));

		await expect(
			service.createTransaction('user-1', 'request-123', {
				type: 'expense',
				amount: 50_000,
				accountId: 'foreign-account',
				categoryId: null,
				date: '2026-08-30',
				description: null
			})
		).rejects.toMatchObject({
			code: 'ACCOUNT_NOT_FOUND',
			status: 400
		} satisfies Partial<FinanceError>);
		expect(repository.createTransactionAtomic).not.toHaveBeenCalled();
	});

	it('rejects movements before the account opening date', async () => {
		const { repository } = createRepository();
		const service = createFinancialMutationService(repository);

		await expect(
			service.createTransaction('user-1', 'request-123', {
				type: 'income',
				amount: 50_000,
				accountId: 'account-1',
				categoryId: null,
				date: '2025-12-31',
				description: null
			})
		).rejects.toMatchObject({ code: 'DATE_BEFORE_ACCOUNT_OPENING', status: 400 });
		expect(repository.createTransactionAtomic).not.toHaveBeenCalled();
	});

	it('updates a transaction balance by the delta and returns the persisted row', async () => {
		const { repository, accounts, transactions } = createRepository();
		transactions.set(
			'txn-1',
			persistedTransaction({
				id: 'txn-1',
				userId: 'user-1',
				date: '2026-08-29',
				type: 'expense',
				amount: 100_000,
				accountId: 'account-1'
			})
		);
		const service = createFinancialMutationService(repository);

		const updated = await service.updateTransaction('user-1', 'txn-1', { amount: 150_000 });

		expect(updated.amount).toBe(150_000);
		expect(repository.updateTransactionAtomic).toHaveBeenCalledWith(
			'user-1',
			'txn-1',
			'account-1',
			{ amount: 150_000 },
			-50_000
		);
		expect(accounts.get('account-1')?.balance).toBe(950_000);
	});

	it('prevents a linked transfer or debt payment from being changed independently', async () => {
		const { repository, transactions } = createRepository();
		transactions.set(
			'transfer-entry',
			persistedTransaction({
				id: 'transfer-entry',
				userId: 'user-1',
				date: '2026-08-29',
				type: 'expense',
				amount: 100_000,
				accountId: 'account-1',
				toAccountId: 'account-2'
			})
		);
		const service = createFinancialMutationService(repository);

		await expect(
			service.updateTransaction('user-1', 'transfer-entry', { amount: 150_000 })
		).rejects.toMatchObject({ code: 'LINKED_TRANSACTION', status: 409 });
		await expect(service.deleteTransaction('user-1', 'transfer-entry')).rejects.toMatchObject({
			code: 'LINKED_TRANSACTION',
			status: 409
		});
		expect(repository.updateTransactionAtomic).not.toHaveBeenCalled();
		expect(repository.deleteTransactionAtomic).not.toHaveBeenCalled();
	});

	it('uses the same debt identifier for insertion, response, and retry', async () => {
		const { repository } = createRepository();
		const service = createFinancialMutationService(repository, ids('debt-1', 'command-1'));
		const input = {
			type: 'piutang' as const,
			contactName: 'Budi',
			contactPhone: null,
			contactAddress: null,
			originalAmount: 500_000,
			date: '2026-08-30',
			dueDate: null,
			description: null
		};

		const created = await service.createDebt('user-1', 'debt-request-1', input);
		const replayed = await service.createDebt('user-1', 'debt-request-1', input);

		expect(created.entity.id).toBe('debt-1');
		expect(replayed).toMatchObject({ entity: { id: 'debt-1' }, replayed: true });
		expect(repository.createDebtAtomic).toHaveBeenCalledTimes(1);
	});

	it('rejects a payment dated before its debt', async () => {
		const { repository, debts } = createRepository();
		debts.set('debt-1', {
			id: 'debt-1',
			userId: 'user-1',
			type: 'hutang',
			contactName: 'Supplier',
			contactPhone: null,
			contactAddress: null,
			originalAmount: 500_000,
			paidAmount: 0,
			remainingAmount: 500_000,
			date: '2026-08-20',
			dueDate: null,
			description: null,
			status: 'active',
			isActive: true,
			createdAt: now,
			updatedAt: now,
			payments: []
		});
		const service = createFinancialMutationService(repository);

		await expect(
			service.recordDebtPayment('user-1', 'debt-1', 'payment-request', {
				amount: 100_000,
				date: '2026-08-19',
				accountId: 'account-1',
				notes: null
			})
		).rejects.toMatchObject({ code: 'PAYMENT_BEFORE_DEBT', status: 400 });
		expect(repository.recordDebtPaymentAtomic).not.toHaveBeenCalled();
	});

	it('keeps debts with payment history from being removed', async () => {
		const { repository, debts } = createRepository();
		debts.set('debt-1', {
			id: 'debt-1',
			userId: 'user-1',
			type: 'piutang',
			contactName: 'Budi',
			contactPhone: null,
			contactAddress: null,
			originalAmount: 500_000,
			paidAmount: 100_000,
			remainingAmount: 400_000,
			date: '2026-08-20',
			dueDate: null,
			description: null,
			status: 'active',
			isActive: true,
			createdAt: now,
			updatedAt: now,
			payments: [
				{
					id: 'payment-1',
					debtId: 'debt-1',
					userId: 'user-1',
					amount: 100_000,
					date: '2026-08-21',
					accountId: 'account-1',
					transactionId: 'txn-1',
					notes: null,
					createdAt: now
				}
			]
		});
		const service = createFinancialMutationService(repository);

		await expect(service.deleteDebt('user-1', 'debt-1')).rejects.toMatchObject({
			code: 'DEBT_HAS_PAYMENTS',
			status: 409
		});
		expect(repository.deleteDebt).not.toHaveBeenCalled();
	});
});

import { db, generateId, now } from './index';
import type { TransactionRecord, SyncStatus } from './schema';

// ============================================================================
// Transaction CRUD Operations
// ============================================================================

export interface CreateTransactionInput {
	userId: string;
	date: string;
	type: 'income' | 'expense' | 'transfer';
	amount: number;
	description?: string;
	accountId: string;
	toAccountId?: string;
	categoryId?: string;
	debtId?: string;
	isTaxed?: boolean;
	taxAmount?: number;
	referenceNumber?: string;
	notes?: string;
}

export interface UpdateTransactionInput {
	date?: string;
	type?: 'income' | 'expense' | 'transfer';
	amount?: number;
	description?: string;
	accountId?: string;
	toAccountId?: string;
	categoryId?: string;
	debtId?: string;
	isTaxed?: boolean;
	taxAmount?: number;
	referenceNumber?: string;
	notes?: string;
	isActive?: boolean;
}

/**
 * Create a new transaction
 */
export async function createTransaction(input: CreateTransactionInput): Promise<TransactionRecord> {
	const record: TransactionRecord = {
		id: generateId(),
		userId: input.userId,
		date: input.date,
		type: input.type,
		amount: input.amount,
		description: input.description ?? null,
		accountId: input.accountId,
		toAccountId: input.toAccountId ?? null,
		categoryId: input.categoryId ?? null,
		debtId: input.debtId ?? null,
		isTaxed: input.isTaxed ?? false,
		taxAmount: input.taxAmount ?? 0,
		referenceNumber: input.referenceNumber ?? null,
		notes: input.notes ?? null,
		isActive: true,
		createdAt: now(),
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.transactions.add(record);
	return record;
}

/**
 * Get transaction by ID
 */
export async function getTransaction(id: string): Promise<TransactionRecord | undefined> {
	return db.transactions.get(id);
}

/**
 * Get all transactions for a user with optional filters
 */
export async function getTransactions(
	userId: string,
	options?: {
		type?: 'income' | 'expense' | 'transfer';
		accountId?: string;
		categoryId?: string;
		startDate?: string;
		endDate?: string;
		isActive?: boolean;
		syncStatus?: SyncStatus;
		limit?: number;
		offset?: number;
	}
): Promise<TransactionRecord[]> {
	const collection = db.transactions.where('userId').equals(userId);

	// Build compound key index for better performance
	// Dexie supports multi-entry indexing, so we filter in memory for complex queries
	let results = await collection.toArray();

	// Apply filters
	if (options?.type) {
		results = results.filter((t) => t.type === options.type);
	}
	if (options?.accountId) {
		results = results.filter(
			(t) => t.accountId === options.accountId || t.toAccountId === options.accountId
		);
	}
	if (options?.categoryId) {
		results = results.filter((t) => t.categoryId === options.categoryId);
	}
	if (options?.startDate) {
		results = results.filter((t) => t.date >= options.startDate!);
	}
	if (options?.endDate) {
		results = results.filter((t) => t.date <= options.endDate!);
	}
	if (options?.isActive !== undefined) {
		results = results.filter((t) => t.isActive === options.isActive);
	}
	if (options?.syncStatus) {
		results = results.filter((t) => t.syncStatus === options.syncStatus);
	}

	// Sort by date descending (newest first)
	results.sort((a, b) => b.date.localeCompare(a.date));

	// Apply pagination
	const offset = options?.offset ?? 0;
	const limit = options?.limit ?? 50;
	return results.slice(offset, offset + limit);
}

/**
 * Get transaction count for a user
 */
export async function getTransactionCount(
	userId: string,
	options?: {
		type?: 'income' | 'expense' | 'transfer';
		startDate?: string;
		endDate?: string;
		isActive?: boolean;
	}
): Promise<number> {
	const collection = db.transactions.where('userId').equals(userId);

	// Apply filters using Dexie's and() for efficient querying
	let results = await collection.toArray();

	// Apply filters
	if (options?.type) {
		results = results.filter((t) => t.type === options.type);
	}
	if (options?.startDate) {
		results = results.filter((t) => t.date >= options.startDate!);
	}
	if (options?.endDate) {
		results = results.filter((t) => t.date <= options.endDate!);
	}
	if (options?.isActive !== undefined) {
		results = results.filter((t) => t.isActive === options.isActive);
	}

	return results.length;
}

/**
 * Update a transaction
 */
export async function updateTransaction(
	id: string,
	input: UpdateTransactionInput
): Promise<TransactionRecord | undefined> {
	const existing = await db.transactions.get(id);
	if (!existing) return undefined;

	const updated: TransactionRecord = {
		...existing,
		...input,
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.transactions.put(updated);
	return updated;
}

/**
 * Soft delete a transaction (mark as inactive)
 */
export async function deleteTransaction(id: string): Promise<boolean> {
	const existing = await db.transactions.get(id);
	if (!existing) return false;

	existing.isActive = false;
	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.transactions.put(existing);
	return true;
}

/**
 * Permanently delete a transaction
 */
export async function hardDeleteTransaction(id: string): Promise<boolean> {
	const existing = await db.transactions.get(id);
	if (!existing) return false;

	await db.transactions.delete(id);
	return true;
}

/**
 * Get pending transactions for sync
 */
export async function getPendingTransactions(userId: string): Promise<TransactionRecord[]> {
	return db.transactions
		.where('userId')
		.equals(userId)
		.and((t) => t.syncStatus === 'pending')
		.toArray();
}

/**
 * Mark transactions as synced
 */
export async function markTransactionsSynced(ids: string[]): Promise<void> {
	await db.transaction('rw', db.transactions, async () => {
		for (const id of ids) {
			const transaction = await db.transactions.get(id);
			if (transaction) {
				transaction.syncStatus = 'synced';
				await db.transactions.put(transaction);
			}
		}
	});
}

/**
 * Get transaction totals for a date range
 */
export async function getTransactionTotals(
	userId: string,
	startDate?: string,
	endDate?: string
): Promise<{ income: number; expense: number; transfer: number }> {
	const transactions = await getTransactions(userId, { startDate, endDate });

	let income = 0;
	let expense = 0;
	let transfer = 0;

	for (const t of transactions) {
		if (t.type === 'income') income += t.amount;
		else if (t.type === 'expense') expense += t.amount;
		else transfer += t.amount;
	}

	return { income, expense, transfer };
}

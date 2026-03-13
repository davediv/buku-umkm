import { db, generateId, now } from './index';
import type { ChartOfAccountRecord, SyncStatus } from './schema';

// ============================================================================
// Chart of Account CRUD Operations
// ============================================================================

export interface CreateAccountInput {
	userId: string;
	code: string;
	name: string;
	type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	subType?: string;
	isSystem?: boolean;
	parentId?: string;
	balance?: number;
}

export interface UpdateAccountInput {
	code?: string;
	name?: string;
	type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	subType?: string;
	isActive?: boolean;
	parentId?: string;
	balance?: number;
}

/**
 * Create a new account
 */
export async function createAccount(input: CreateAccountInput): Promise<ChartOfAccountRecord> {
	const record: ChartOfAccountRecord = {
		id: generateId(),
		userId: input.userId,
		code: input.code,
		name: input.name,
		type: input.type,
		subType: input.subType ?? null,
		isSystem: input.isSystem ?? false,
		isActive: true,
		parentId: input.parentId ?? null,
		balance: input.balance ?? 0,
		createdAt: now(),
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.accounts.add(record);
	return record;
}

/**
 * Get account by ID
 */
export async function getAccount(id: string): Promise<ChartOfAccountRecord | undefined> {
	return db.accounts.get(id);
}

/**
 * Get all accounts for a user
 */
export async function getAccounts(
	userId: string,
	options?: {
		type?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
		isActive?: boolean;
		syncStatus?: SyncStatus;
	}
): Promise<ChartOfAccountRecord[]> {
	const collection = db.accounts.where('userId').equals(userId);
	let results = await collection.toArray();

	if (options?.type) {
		results = results.filter((a) => a.type === options.type);
	}
	if (options?.isActive !== undefined) {
		results = results.filter((a) => a.isActive === options.isActive);
	}
	if (options?.syncStatus) {
		results = results.filter((a) => a.syncStatus === options.syncStatus);
	}

	// Sort by code
	results.sort((a, b) => a.code.localeCompare(b.code));
	return results;
}

/**
 * Get account by code for a user
 */
export async function getAccountByCode(
	userId: string,
	code: string
): Promise<ChartOfAccountRecord | undefined> {
	const accounts = await db.accounts
		.where('userId')
		.equals(userId)
		.and((a) => a.code === code)
		.toArray();
	return accounts[0];
}

/**
 * Update an account
 */
export async function updateAccount(
	id: string,
	input: UpdateAccountInput
): Promise<ChartOfAccountRecord | undefined> {
	const existing = await db.accounts.get(id);
	if (!existing) return undefined;

	const updated: ChartOfAccountRecord = {
		...existing,
		...input,
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.accounts.put(updated);
	return updated;
}

/**
 * Update account balance
 */
export async function updateAccountBalance(
	id: string,
	balanceChange: number
): Promise<ChartOfAccountRecord | undefined> {
	const existing = await db.accounts.get(id);
	if (!existing) return undefined;

	existing.balance += balanceChange;
	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.accounts.put(existing);
	return existing;
}

/**
 * Delete an account (soft delete)
 */
export async function deleteAccount(id: string): Promise<boolean> {
	const existing = await db.accounts.get(id);
	if (!existing) return false;

	existing.isActive = false;
	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.accounts.put(existing);
	return true;
}

/**
 * Get pending accounts for sync
 */
export async function getPendingAccounts(userId: string): Promise<ChartOfAccountRecord[]> {
	return db.accounts
		.where('userId')
		.equals(userId)
		.and((a) => a.syncStatus === 'pending')
		.toArray();
}

/**
 * Mark accounts as synced
 */
export async function markAccountsSynced(ids: string[]): Promise<void> {
	await db.transaction('rw', db.accounts, async () => {
		for (const id of ids) {
			const account = await db.accounts.get(id);
			if (account) {
				account.syncStatus = 'synced';
				await db.accounts.put(account);
			}
		}
	});
}

/**
 * Get total balance by account type
 */
export async function getBalanceByType(
	userId: string
): Promise<Record<'asset' | 'liability' | 'equity' | 'revenue' | 'expense', number>> {
	const accounts = await getAccounts(userId, { isActive: true });

	const totals: Record<string, number> = {
		asset: 0,
		liability: 0,
		equity: 0,
		revenue: 0,
		expense: 0
	};

	for (const account of accounts) {
		totals[account.type] += account.balance;
	}

	return totals as Record<'asset' | 'liability' | 'equity' | 'revenue' | 'expense', number>;
}

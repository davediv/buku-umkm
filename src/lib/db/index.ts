import Dexie, { type Table } from 'dexie';
import type {
	UserExtensionRecord,
	BusinessProfileRecord,
	ChartOfAccountRecord,
	CategoryRecord,
	TransactionRecord,
	DebtRecord,
	DebtPaymentRecord,
	TaxRecordRecord,
	TransactionPhotoRecord,
	BackupRecord,
	SyncStatus
} from './schema';

// ============================================================================
// Database Setup
// ============================================================================

export class BukuUmkmDB extends Dexie {
	// Tables
	userExtension!: Table<UserExtensionRecord>;
	businessProfiles!: Table<BusinessProfileRecord>;
	accounts!: Table<ChartOfAccountRecord>;
	categories!: Table<CategoryRecord>;
	transactions!: Table<TransactionRecord>;
	debts!: Table<DebtRecord>;
	debtPayments!: Table<DebtPaymentRecord>;
	taxRecords!: Table<TaxRecordRecord>;
	transactionPhotos!: Table<TransactionPhotoRecord>;
	backups!: Table<BackupRecord>;

	constructor() {
		super('buku-umkm');

		this.version(1).stores({
			// Primary index: id
			// Secondary indexes: userId, syncStatus
			userExtension: 'id, userId, syncStatus',
			businessProfiles: 'id, userId, syncStatus',
			accounts: 'id, userId, type, syncStatus, parentId',
			categories: 'id, userId, type, syncStatus',
			transactions: 'id, userId, date, type, accountId, categoryId, syncStatus, isActive',
			debts: 'id, userId, type, status, syncStatus, isActive',
			debtPayments: 'id, debtId, userId, date, transactionId, syncStatus',
			taxRecords: 'id, userId, year, month, status, syncStatus',
			transactionPhotos: 'id, transactionId, userId, syncStatus',
			backups: 'id, userId, type, status, syncStatus'
		});
	}
}

// Export singleton instance
export const db = new BukuUmkmDB();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a new UUID
 */
export function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Get current timestamp
 */
export function now(): Date {
	return new Date();
}

/**
 * Create a new record with default sync status
 */
export function createRecord<T extends { syncStatus: SyncStatus }>(
	partial: Omit<T, 'syncStatus' | 'createdAt' | 'updatedAt'>,
	userId: string
): Omit<T, 'syncStatus'> & { syncStatus: SyncStatus; createdAt: Date; updatedAt: Date } {
	const timestamp = now();
	return {
		...partial,
		userId,
		syncStatus: 'pending',
		createdAt: timestamp,
		updatedAt: timestamp
	} as Omit<T, 'syncStatus'> & { syncStatus: SyncStatus; createdAt: Date; updatedAt: Date };
}

/**
 * Mark a record as needing sync
 */
export function markPending<T extends { syncStatus: SyncStatus; updatedAt: Date }>(record: T): T {
	return {
		...record,
		syncStatus: 'pending',
		updatedAt: now()
	};
}

/**
 * Mark a record as synced
 */
export function markSynced<T extends { syncStatus: SyncStatus }>(record: T): T {
	return {
		...record,
		syncStatus: 'synced'
	};
}

/**
 * Mark a record as error
 */
export function markError<T extends { syncStatus: SyncStatus }>(record: T): T {
	return {
		...record,
		syncStatus: 'error'
	};
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Clear all data for a user (used when logging out)
 */
export async function clearUserData(userId: string): Promise<void> {
	await db.transaction(
		'rw',
		[
			db.userExtension,
			db.businessProfiles,
			db.accounts,
			db.categories,
			db.transactions,
			db.debts,
			db.debtPayments,
			db.taxRecords,
			db.transactionPhotos,
			db.backups
		],
		async () => {
			await db.userExtension.where('userId').equals(userId).delete();
			await db.businessProfiles.where('userId').equals(userId).delete();
			await db.accounts.where('userId').equals(userId).delete();
			await db.categories.where('userId').equals(userId).delete();
			await db.transactions.where('userId').equals(userId).delete();
			await db.debts.where('userId').equals(userId).delete();
			await db.debtPayments.where('userId').equals(userId).delete();
			await db.taxRecords.where('userId').equals(userId).delete();
			await db.transactionPhotos.where('userId').equals(userId).delete();
			await db.backups.where('userId').equals(userId).delete();
		}
	);
}

/**
 * Clear all data in the database (used for full reset)
 */
export async function clearAllData(): Promise<void> {
	await db.transaction(
		'rw',
		[
			db.userExtension,
			db.businessProfiles,
			db.accounts,
			db.categories,
			db.transactions,
			db.debts,
			db.debtPayments,
			db.taxRecords,
			db.transactionPhotos,
			db.backups
		],
		async () => {
			await db.userExtension.clear();
			await db.businessProfiles.clear();
			await db.accounts.clear();
			await db.categories.clear();
			await db.transactions.clear();
			await db.debts.clear();
			await db.debtPayments.clear();
			await db.taxRecords.clear();
			await db.transactionPhotos.clear();
			await db.backups.clear();
		}
	);
}

/**
 * Get count of all records for a user
 */
export async function getRecordCounts(userId: string): Promise<{
	accounts: number;
	categories: number;
	transactions: number;
	debts: number;
	taxRecords: number;
}> {
	const [accounts, categories, transactions, debts, taxRecords] = await Promise.all([
		db.accounts.where('userId').equals(userId).count(),
		db.categories.where('userId').equals(userId).count(),
		db.transactions.where('userId').equals(userId).count(),
		db.debts.where('userId').equals(userId).count(),
		db.taxRecords.where('userId').equals(userId).count()
	]);

	return { accounts, categories, transactions, debts, taxRecords };
}

/**
 * Get all pending records for sync
 */
export async function getPendingRecords(userId: string): Promise<{
	accounts: ChartOfAccountRecord[];
	categories: CategoryRecord[];
	transactions: TransactionRecord[];
	debts: DebtRecord[];
	taxRecords: TaxRecordRecord[];
	businessProfiles: BusinessProfileRecord[];
}> {
	const [accounts, categories, transactions, debts, taxRecords, businessProfiles] =
		await Promise.all([
			db.accounts
				.where('userId')
				.equals(userId)
				.and((r) => r.syncStatus === 'pending')
				.toArray(),
			db.categories
				.where('userId')
				.equals(userId)
				.and((r) => r.syncStatus === 'pending')
				.toArray(),
			db.transactions
				.where('userId')
				.equals(userId)
				.and((r) => r.syncStatus === 'pending')
				.toArray(),
			db.debts
				.where('userId')
				.equals(userId)
				.and((r) => r.syncStatus === 'pending')
				.toArray(),
			db.taxRecords
				.where('userId')
				.equals(userId)
				.and((r) => r.syncStatus === 'pending')
				.toArray(),
			db.businessProfiles
				.where('userId')
				.equals(userId)
				.and((r) => r.syncStatus === 'pending')
				.toArray()
		]);

	return { accounts, categories, transactions, debts, taxRecords, businessProfiles };
}

export { type SyncStatus } from './schema';

// Re-export from other modules for convenience
export * from './transactions';
export * from './accounts';
export * from './categories';
export * from './debts';
export * from './tax-records';
export * from './business-profile';
export * from './sync';
export type { SyncState } from './sync';
export * from './usage';
export type { StorageInfo } from './usage';
export * from './stores.svelte';

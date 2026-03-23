// Sync API for offline-to-online synchronization
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import {
	transaction,
	chartOfAccount,
	category,
	debt,
	businessProfile
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

// Batch size for syncing records
const BATCH_SIZE = 50;
const MAX_SYNC_BODY_SIZE = 5 * 1024 * 1024;
const MAX_STRING_LENGTH = 500;

// ============================================================================
// Input Validation Helpers
// ============================================================================

function isValidId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 36;
}

function isValidDateString(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const date = new Date(value);
	return !isNaN(date.getTime());
}

function isValidAmount(value: unknown): boolean {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		value >= 0 &&
		value <= MAX_TRANSACTION_AMOUNT
	);
}

function truncStr(value: unknown, maxLen = MAX_STRING_LENGTH): string | null {
	if (value === null || value === undefined) return null;
	const str = String(value);
	return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function validateBaseRecord(record: Record<string, unknown>): boolean {
	return (
		isValidId(record.id) &&
		isValidDateString(record.createdAt) &&
		isValidDateString(record.updatedAt)
	);
}

// ============================================================================
// Helper: Convert IndexedDB record to D1 schema format
// ============================================================================

function toTransactionDbRecord(record: Record<string, unknown>, userId: string) {
	return {
		id: record.id as string,
		userId,
		date: record.date as string,
		type: record.type as 'income' | 'expense' | 'transfer',
		amount: record.amount as number,
		description: truncStr(record.description),
		accountId: record.accountId as string,
		toAccountId: truncStr(record.toAccountId, 36),
		categoryId: truncStr(record.categoryId, 36),
		debtId: truncStr(record.debtId, 36),
		isTaxed: record.isTaxed as boolean,
		taxAmount: record.taxAmount as number,
		referenceNumber: truncStr(record.referenceNumber, 100),
		notes: truncStr(record.notes),
		isActive: record.isActive as boolean,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toAccountDbRecord(record: Record<string, unknown>, userId: string) {
	return {
		id: record.id as string,
		userId,
		code: truncStr(record.code, 20) as string,
		name: truncStr(record.name, 200) as string,
		type: record.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
		subType: truncStr(record.subType, 50),
		isSystem: record.isSystem as boolean,
		isActive: record.isActive as boolean,
		parentId: truncStr(record.parentId, 36),
		balance: record.balance as number,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toCategoryDbRecord(record: Record<string, unknown>, userId: string) {
	return {
		id: record.id as string,
		userId,
		code: truncStr(record.code, 20) as string,
		name: truncStr(record.name, 200) as string,
		type: record.type as 'income' | 'expense',
		isSystem: record.isSystem as boolean,
		isActive: record.isActive as boolean,
		icon: truncStr(record.icon, 50),
		color: truncStr(record.color, 20),
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toDebtDbRecord(record: Record<string, unknown>, userId: string) {
	return {
		id: record.id as string,
		userId,
		type: record.type as 'piutang' | 'hutang',
		contactName: truncStr(record.contactName, 200) as string,
		contactPhone: truncStr(record.contactPhone, 20),
		contactAddress: truncStr(record.contactAddress),
		originalAmount: record.originalAmount as number,
		paidAmount: record.paidAmount as number,
		remainingAmount: record.remainingAmount as number,
		date: record.date as string,
		dueDate: record.dueDate as string | null,
		description: truncStr(record.description),
		status: record.status as 'active' | 'paid' | 'overdue',
		isActive: record.isActive as boolean,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toBusinessProfileDbRecord(record: Record<string, unknown>, userId: string) {
	return {
		id: record.id as string,
		userId,
		name: truncStr(record.name, 200) as string,
		address: truncStr(record.address),
		phone: truncStr(record.phone, 20),
		npwp: truncStr(record.npwp, 100),
		businessType: truncStr(record.businessType, 50) as string,
		ownerName: truncStr(record.ownerName, 200),
		industry: truncStr(record.industry, 100),
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

// ============================================================================
// POST /api/sync - Batch sync records to server
// ============================================================================

export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Enforce body size limit - check actual body, not just Content-Length header
		const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
		if (contentLength > MAX_SYNC_BODY_SIZE) {
			return json({ error: 'Request body too large' }, { status: 413 });
		}

		const text = await request.text();
		if (text.length > MAX_SYNC_BODY_SIZE) {
			return json({ error: 'Request body too large' }, { status: 413 });
		}

		const body = JSON.parse(text);

		const {
			transactions = [],
			accounts = [],
			categories = [],
			debts = [],
			businessProfiles = []
		} = body as Record<string, unknown[]>;

		// Limit total record count to prevent resource exhaustion
		const MAX_RECORDS_PER_SYNC = 5000;
		const totalRecords =
			transactions.length +
			accounts.length +
			categories.length +
			debts.length +
			businessProfiles.length;
		if (totalRecords > MAX_RECORDS_PER_SYNC) {
			return json({ error: `Maksimal ${MAX_RECORDS_PER_SYNC} record per sync` }, { status: 400 });
		}

		const results: {
			transactions: { id: string; success: boolean; error?: string }[];
			accounts: { id: string; success: boolean; error?: string }[];
			categories: { id: string; success: boolean; error?: string }[];
			debts: { id: string; success: boolean; error?: string }[];
			businessProfiles: { id: string; success: boolean; error?: string }[];
		} = {
			transactions: [],
			accounts: [],
			categories: [],
			debts: [],
			businessProfiles: []
		};

		// Process transactions in batches
		for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
			const batch = transactions.slice(i, i + BATCH_SIZE) as Record<string, unknown>[];

			await db.transaction(async (tx) => {
				for (const record of batch) {
					try {
						if (
							!validateBaseRecord(record) ||
							!['income', 'expense', 'transfer'].includes(record.type as string) ||
							!isValidAmount(record.amount)
						) {
							results.transactions.push({
								id: String(record.id || 'unknown'),
								success: false,
								error: 'Validation failed'
							});
							continue;
						}

						const dbRecord = toTransactionDbRecord(record, userId);
						const existing = await tx
							.select()
							.from(transaction)
							.where(and(eq(transaction.id, dbRecord.id), eq(transaction.userId, userId)))
							.limit(1)
							.then((r) => r[0]);

						if (existing) {
							// Conflict resolution: last-write-wins
							// Only update if local record is newer
							if (new Date(dbRecord.updatedAt) > new Date(existing.updatedAt)) {
								await tx
									.update(transaction)
									.set({
										date: dbRecord.date,
										type: dbRecord.type,
										amount: dbRecord.amount,
										description: dbRecord.description,
										accountId: dbRecord.accountId,
										toAccountId: dbRecord.toAccountId,
										categoryId: dbRecord.categoryId,
										debtId: dbRecord.debtId,
										isTaxed: dbRecord.isTaxed,
										taxAmount: dbRecord.taxAmount,
										referenceNumber: dbRecord.referenceNumber,
										notes: dbRecord.notes,
										isActive: dbRecord.isActive,
										updatedAt: dbRecord.updatedAt
									})
									.where(eq(transaction.id, dbRecord.id));
							}
						} else {
							// Insert new record
							await tx.insert(transaction).values(dbRecord);
						}
						results.transactions.push({ id: dbRecord.id, success: true });
					} catch {
						results.transactions.push({
							id: String(record.id || 'unknown'),
							success: false,
							error: 'Sync failed'
						});
					}
				}
			});
		}

		// Process accounts in batches
		for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
			const batch = accounts.slice(i, i + BATCH_SIZE) as Record<string, unknown>[];

			await db.transaction(async (tx) => {
				for (const record of batch) {
					try {
						if (
							!validateBaseRecord(record) ||
							!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(
								record.type as string
							)
						) {
							results.accounts.push({
								id: String(record.id || 'unknown'),
								success: false,
								error: 'Validation failed'
							});
							continue;
						}

						const dbRecord = toAccountDbRecord(record, userId);
						const existing = await tx
							.select()
							.from(chartOfAccount)
							.where(and(eq(chartOfAccount.id, dbRecord.id), eq(chartOfAccount.userId, userId)))
							.limit(1)
							.then((r) => r[0]);

						if (existing) {
							// Conflict resolution: last-write-wins
							if (new Date(dbRecord.updatedAt) > new Date(existing.updatedAt)) {
								await tx
									.update(chartOfAccount)
									.set({
										code: dbRecord.code,
										name: dbRecord.name,
										type: dbRecord.type,
										subType: dbRecord.subType,
										isActive: dbRecord.isActive,
										parentId: dbRecord.parentId,
										balance: dbRecord.balance,
										updatedAt: dbRecord.updatedAt
									})
									.where(eq(chartOfAccount.id, dbRecord.id));
							}
						} else {
							await tx.insert(chartOfAccount).values(dbRecord);
						}
						results.accounts.push({ id: dbRecord.id, success: true });
					} catch {
						results.accounts.push({
							id: String(record.id || 'unknown'),
							success: false,
							error: 'Sync failed'
						});
					}
				}
			});
		}

		// Process categories in batches
		for (let i = 0; i < categories.length; i += BATCH_SIZE) {
			const batch = categories.slice(i, i + BATCH_SIZE) as Record<string, unknown>[];

			await db.transaction(async (tx) => {
				for (const record of batch) {
					try {
						if (
							!validateBaseRecord(record) ||
							!['income', 'expense'].includes(record.type as string)
						) {
							results.categories.push({
								id: String(record.id || 'unknown'),
								success: false,
								error: 'Validation failed'
							});
							continue;
						}

						const dbRecord = toCategoryDbRecord(record, userId);
						const existing = await tx
							.select()
							.from(category)
							.where(and(eq(category.id, dbRecord.id), eq(category.userId, userId)))
							.limit(1)
							.then((r) => r[0]);

						if (existing) {
							if (new Date(dbRecord.updatedAt) > new Date(existing.updatedAt)) {
								await tx
									.update(category)
									.set({
										code: dbRecord.code,
										name: dbRecord.name,
										type: dbRecord.type,
										isActive: dbRecord.isActive,
										icon: dbRecord.icon,
										color: dbRecord.color,
										updatedAt: dbRecord.updatedAt
									})
									.where(eq(category.id, dbRecord.id));
							}
						} else {
							await tx.insert(category).values(dbRecord);
						}
						results.categories.push({ id: dbRecord.id, success: true });
					} catch {
						results.categories.push({
							id: String(record.id || 'unknown'),
							success: false,
							error: 'Sync failed'
						});
					}
				}
			});
		}

		// Process debts in batches
		for (let i = 0; i < debts.length; i += BATCH_SIZE) {
			const batch = debts.slice(i, i + BATCH_SIZE) as Record<string, unknown>[];

			await db.transaction(async (tx) => {
				for (const record of batch) {
					try {
						if (
							!validateBaseRecord(record) ||
							!['piutang', 'hutang'].includes(record.type as string) ||
							!isValidAmount(record.originalAmount)
						) {
							results.debts.push({
								id: String(record.id || 'unknown'),
								success: false,
								error: 'Validation failed'
							});
							continue;
						}

						const dbRecord = toDebtDbRecord(record, userId);
						const existing = await tx
							.select()
							.from(debt)
							.where(and(eq(debt.id, dbRecord.id), eq(debt.userId, userId)))
							.limit(1)
							.then((r) => r[0]);

						if (existing) {
							if (new Date(dbRecord.updatedAt) > new Date(existing.updatedAt)) {
								await tx
									.update(debt)
									.set({
										type: dbRecord.type,
										contactName: dbRecord.contactName,
										contactPhone: dbRecord.contactPhone,
										contactAddress: dbRecord.contactAddress,
										originalAmount: dbRecord.originalAmount,
										paidAmount: dbRecord.paidAmount,
										remainingAmount: dbRecord.remainingAmount,
										date: dbRecord.date,
										dueDate: dbRecord.dueDate,
										description: dbRecord.description,
										status: dbRecord.status,
										isActive: dbRecord.isActive,
										updatedAt: dbRecord.updatedAt
									})
									.where(eq(debt.id, dbRecord.id));
							}
						} else {
							await tx.insert(debt).values(dbRecord);
						}
						results.debts.push({ id: dbRecord.id, success: true });
					} catch {
						results.debts.push({
							id: String(record.id || 'unknown'),
							success: false,
							error: 'Sync failed'
						});
					}
				}
			});
		}

		// Process business profiles
		for (const record of businessProfiles as Record<string, unknown>[]) {
			try {
				if (!validateBaseRecord(record)) {
					results.businessProfiles.push({
						id: String(record.id || 'unknown'),
						success: false,
						error: 'Validation failed'
					});
					continue;
				}

				const dbRecord = toBusinessProfileDbRecord(record, userId);
				const existing = await db
					.select()
					.from(businessProfile)
					.where(and(eq(businessProfile.id, dbRecord.id), eq(businessProfile.userId, userId)))
					.limit(1)
					.then((r) => r[0]);

				if (existing) {
					if (new Date(dbRecord.updatedAt) > new Date(existing.updatedAt)) {
						await db
							.update(businessProfile)
							.set({
								name: dbRecord.name,
								address: dbRecord.address,
								phone: dbRecord.phone,
								npwp: dbRecord.npwp,
								businessType: dbRecord.businessType,
								ownerName: dbRecord.ownerName,
								industry: dbRecord.industry,
								updatedAt: dbRecord.updatedAt
							})
							.where(eq(businessProfile.id, dbRecord.id));
					}
				} else {
					await db.insert(businessProfile).values(dbRecord);
				}
				results.businessProfiles.push({ id: dbRecord.id, success: true });
			} catch {
				results.businessProfiles.push({
					id: String(record.id || 'unknown'),
					success: false,
					error: 'Sync failed'
				});
			}
		}

		return json({
			message: 'Sync completed',
			results,
			timestamp: new Date().toISOString()
		});
	} catch {
		console.error('Sync error');
		return json({ error: 'Terjadi kesalahan saat sinkronisasi' }, { status: 500 });
	}
};

// ============================================================================
// GET /api/sync - Get server state for initial sync
// ============================================================================

export const GET: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Note: 'since' parameter is reserved for future incremental sync implementation
		// For now, we sync all data on GET request
		// const since = url.searchParams.get('since');

		// Get all data modified since the given timestamp
		// This is used for initial sync when user logs in from a new device

		const [transactionsData, accountsData, categoriesData, debtsData, profilesData] =
			await Promise.all([
				db
					.select({
						id: transaction.id,
						date: transaction.date,
						type: transaction.type,
						amount: transaction.amount,
						description: transaction.description,
						accountId: transaction.accountId,
						toAccountId: transaction.toAccountId,
						categoryId: transaction.categoryId,
						debtId: transaction.debtId,
						isTaxed: transaction.isTaxed,
						taxAmount: transaction.taxAmount,
						referenceNumber: transaction.referenceNumber,
						notes: transaction.notes,
						isActive: transaction.isActive,
						createdAt: transaction.createdAt,
						updatedAt: transaction.updatedAt
					})
					.from(transaction)
					.where(eq(transaction.userId, userId)),
				db
					.select({
						id: chartOfAccount.id,
						code: chartOfAccount.code,
						name: chartOfAccount.name,
						type: chartOfAccount.type,
						subType: chartOfAccount.subType,
						isSystem: chartOfAccount.isSystem,
						isActive: chartOfAccount.isActive,
						parentId: chartOfAccount.parentId,
						balance: chartOfAccount.balance,
						createdAt: chartOfAccount.createdAt,
						updatedAt: chartOfAccount.updatedAt
					})
					.from(chartOfAccount)
					.where(eq(chartOfAccount.userId, userId)),
				db
					.select({
						id: category.id,
						code: category.code,
						name: category.name,
						type: category.type,
						isSystem: category.isSystem,
						isActive: category.isActive,
						icon: category.icon,
						color: category.color,
						createdAt: category.createdAt,
						updatedAt: category.updatedAt
					})
					.from(category)
					.where(eq(category.userId, userId)),
				db
					.select({
						id: debt.id,
						type: debt.type,
						contactName: debt.contactName,
						contactPhone: debt.contactPhone,
						contactAddress: debt.contactAddress,
						originalAmount: debt.originalAmount,
						paidAmount: debt.paidAmount,
						remainingAmount: debt.remainingAmount,
						date: debt.date,
						dueDate: debt.dueDate,
						description: debt.description,
						status: debt.status,
						isActive: debt.isActive,
						createdAt: debt.createdAt,
						updatedAt: debt.updatedAt
					})
					.from(debt)
					.where(eq(debt.userId, userId)),
				db.select().from(businessProfile).where(eq(businessProfile.userId, userId))
			]);

		return json({
			transactions: transactionsData,
			accounts: accountsData,
			categories: categoriesData,
			debts: debtsData,
			businessProfiles: profilesData,
			timestamp: new Date().toISOString()
		});
	} catch {
		console.error('Sync GET error');
		return json({ error: 'Terjadi kesalahan saat mengambil data' }, { status: 500 });
	}
};

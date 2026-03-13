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

// Batch size for syncing records
const BATCH_SIZE = 50;

// ============================================================================
// Helper: Convert IndexedDB record to D1 schema format
// ============================================================================

function toTransactionDbRecord(record: Record<string, unknown>) {
	return {
		id: record.id as string,
		userId: record.userId as string,
		date: record.date as string,
		type: record.type as 'income' | 'expense' | 'transfer',
		amount: record.amount as number,
		description: record.description as string | null,
		accountId: record.accountId as string,
		toAccountId: record.toAccountId as string | null,
		categoryId: record.categoryId as string | null,
		debtId: record.debtId as string | null,
		isTaxed: record.isTaxed as boolean,
		taxAmount: record.taxAmount as number,
		referenceNumber: record.referenceNumber as string | null,
		notes: record.notes as string | null,
		isActive: record.isActive as boolean,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toAccountDbRecord(record: Record<string, unknown>) {
	return {
		id: record.id as string,
		userId: record.userId as string,
		code: record.code as string,
		name: record.name as string,
		type: record.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
		subType: record.subType as string | null,
		isSystem: record.isSystem as boolean,
		isActive: record.isActive as boolean,
		parentId: record.parentId as string | null,
		balance: record.balance as number,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toCategoryDbRecord(record: Record<string, unknown>) {
	return {
		id: record.id as string,
		userId: record.userId as string,
		code: record.code as string,
		name: record.name as string,
		type: record.type as 'income' | 'expense',
		isSystem: record.isSystem as boolean,
		isActive: record.isActive as boolean,
		icon: record.icon as string | null,
		color: record.color as string | null,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toDebtDbRecord(record: Record<string, unknown>) {
	return {
		id: record.id as string,
		userId: record.userId as string,
		type: record.type as 'piutang' | 'hutang',
		contactName: record.contactName as string,
		contactPhone: record.contactPhone as string | null,
		contactAddress: record.contactAddress as string | null,
		originalAmount: record.originalAmount as number,
		paidAmount: record.paidAmount as number,
		remainingAmount: record.remainingAmount as number,
		date: record.date as string,
		dueDate: record.dueDate as string | null,
		description: record.description as string | null,
		status: record.status as 'active' | 'paid' | 'overdue',
		isActive: record.isActive as boolean,
		createdAt: new Date(record.createdAt as string),
		updatedAt: new Date(record.updatedAt as string)
	};
}

function toBusinessProfileDbRecord(record: Record<string, unknown>) {
	return {
		id: record.id as string,
		userId: record.userId as string,
		name: record.name as string,
		address: record.address as string | null,
		phone: record.phone as string | null,
		npwp: record.npwp as string | null,
		businessType: record.businessType as string,
		ownerName: record.ownerName as string | null,
		industry: record.industry as string | null,
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
		const body = await request.json();

		const {
			transactions = [],
			accounts = [],
			categories = [],
			debts = [],
			businessProfiles = []
		} = body as Record<string, unknown[]>;

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
						const dbRecord = toTransactionDbRecord(record);
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
					} catch (err) {
						const error = err instanceof Error ? err.message : 'Unknown error';
						results.transactions.push({ id: record.id as string, success: false, error });
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
						const dbRecord = toAccountDbRecord(record);
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
					} catch (err) {
						const error = err instanceof Error ? err.message : 'Unknown error';
						results.accounts.push({ id: record.id as string, success: false, error });
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
						const dbRecord = toCategoryDbRecord(record);
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
					} catch (err) {
						const error = err instanceof Error ? err.message : 'Unknown error';
						results.categories.push({ id: record.id as string, success: false, error });
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
						const dbRecord = toDebtDbRecord(record);
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
					} catch (err) {
						const error = err instanceof Error ? err.message : 'Unknown error';
						results.debts.push({ id: record.id as string, success: false, error });
					}
				}
			});
		}

		// Process business profiles
		for (const record of businessProfiles as Record<string, unknown>[]) {
			try {
				const dbRecord = toBusinessProfileDbRecord(record);
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
			} catch (err) {
				const error = err instanceof Error ? err.message : 'Unknown error';
				results.businessProfiles.push({ id: record.id as string, success: false, error });
			}
		}

		return json({
			message: 'Sync completed',
			results,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Sync error:', error);
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
	} catch (error) {
		console.error('Sync GET error:', error);
		return json({ error: 'Terjadi kesalahan saat mengambil data' }, { status: 500 });
	}
};

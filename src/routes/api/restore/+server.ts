import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import {
	chartOfAccount,
	category,
	transaction,
	debt,
	debtPayment,
	taxRecord,
	businessProfile,
	transactionPhoto,
	transactionTemplate
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { BACKUP_SCHEMA_VERSION } from '$lib/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

/**
 * Parse date string to Date object
 * Handles ISO strings, dates, and timestamps
 */
function parseDateToDate(dateValue: string | null | undefined): Date | undefined {
	if (!dateValue) return undefined;
	const date = new Date(dateValue);
	return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Validate backup data structure
 */
function validateBackupData(data: unknown): {
	valid: boolean;
	error?: string;
	version?: string;
} {
	if (!data || typeof data !== 'object') {
		return { valid: false, error: 'Format file tidak valid' };
	}

	const backup = data as Record<string, unknown>;

	// Check schema version
	if (!backup.schemaVersion) {
		return { valid: false, error: 'File backup tidak memiliki versi schema' };
	}

	const schemaVersion = backup.schemaVersion as string;
	const [major] = schemaVersion.split('.').map(Number);

	// Check if schema version is compatible (forward-compatible: newer can restore older)
	const [backupMajor] = BACKUP_SCHEMA_VERSION.split('.').map(Number);
	if (major > backupMajor) {
		return {
			valid: false,
			error: `Versi schema backup (${schemaVersion}) tidak didukung oleh aplikasi ini`
		};
	}

	// Validate required fields exist (even if empty)
	const requiredArrays = [
		'businessProfiles',
		'accounts',
		'categories',
		'transactions',
		'debts',
		'debtPayments',
		'taxRecords',
		'templates',
		'photos'
	];

	for (const field of requiredArrays) {
		if (!Array.isArray(backup[field])) {
			return { valid: false, error: `Field ${field} tidak ditemukan dalam backup` };
		}
	}

	return { valid: true, version: schemaVersion };
}

/**
 * Clear existing user data in correct order (respecting foreign key dependencies)
 */
async function clearUserData(db: DbClient, userId: string): Promise<void> {
	// Delete in reverse order of dependencies
	await Promise.all([
		// Delete transaction photos first (depends on transactions)
		db.delete(transactionPhoto).where(eq(transactionPhoto.userId, userId)),
		// Delete debt payments (depends on debts)
		db.delete(debtPayment).where(eq(debtPayment.userId, userId)),
		// Delete transactions (depends on accounts, categories, debts)
		db.delete(transaction).where(eq(transaction.userId, userId)),
		// Delete debts
		db.delete(debt).where(eq(debt.userId, userId)),
		// Delete tax records
		db.delete(taxRecord).where(eq(taxRecord.userId, userId)),
		// Delete transaction templates
		db.delete(transactionTemplate).where(eq(transactionTemplate.userId, userId)),
		// Delete categories
		db.delete(category).where(eq(category.userId, userId)),
		// Delete chart of accounts
		db.delete(chartOfAccount).where(eq(chartOfAccount.userId, userId)),
		// Delete business profiles
		db.delete(businessProfile).where(eq(businessProfile.userId, userId))
	]);
}

/**
 * Insert backup data for a user
 */
async function insertBackupData(
	db: DbClient,
	userId: string,
	data: Record<string, unknown>
): Promise<void> {
	const backup = data as {
		businessProfiles: Array<Record<string, unknown>>;
		accounts: Array<Record<string, unknown>>;
		categories: Array<Record<string, unknown>>;
		transactions: Array<Record<string, unknown>>;
		debts: Array<Record<string, unknown>>;
		debtPayments: Array<Record<string, unknown>>;
		taxRecords: Array<Record<string, unknown>>;
		templates: Array<Record<string, unknown>>;
		photos: Array<Record<string, unknown>>;
	};

	// Insert business profiles
	if (backup.businessProfiles.length > 0) {
		const profiles = backup.businessProfiles.map((p) => {
			const timestamps = {
				createdAt: parseDateToDate(p.createdAt as string | null | undefined),
				updatedAt: parseDateToDate(p.updatedAt as string | null | undefined)
			};
			return {
				id: p.id as string,
				userId,
				name: p.name as string,
				address: p.address as string | null,
				phone: p.phone as string | null,
				npwp: p.npwp as string | null,
				businessType: p.businessType as string,
				ownerName: p.ownerName as string | null,
				industry: p.industry as string | null,
				...timestamps
			};
		});
		await db.insert(businessProfile).values(profiles);
	}

	// Insert chart of accounts
	if (backup.accounts.length > 0) {
		const accounts = backup.accounts.map((a) => ({
			id: a.id as string,
			userId,
			code: a.code as string,
			name: a.name as string,
			type: a.type as string,
			subType: a.subType as string | null,
			isSystem: Boolean(a.isSystem),
			isActive: Boolean(a.isActive),
			parentId: a.parentId as string | null,
			balance: (a.balance as number) ?? 0,
			createdAt: parseDateToDate(a.createdAt as string | null | undefined),
			updatedAt: parseDateToDate(a.updatedAt as string | null | undefined)
		}));
		await db.insert(chartOfAccount).values(accounts);
	}

	// Insert categories
	if (backup.categories.length > 0) {
		const categories = backup.categories.map((c) => ({
			id: c.id as string,
			userId,
			code: c.code as string,
			name: c.name as string,
			type: c.type as string,
			isSystem: Boolean(c.isSystem),
			isActive: Boolean(c.isActive),
			icon: c.icon as string | null,
			color: c.color as string | null,
			createdAt: parseDateToDate(c.createdAt as string | null | undefined),
			updatedAt: parseDateToDate(c.updatedAt as string | null | undefined)
		}));
		await db.insert(category).values(categories);
	}

	// Insert transactions
	if (backup.transactions.length > 0) {
		const transactions = backup.transactions.map((t) => ({
			id: t.id as string,
			userId,
			date: t.date as string,
			type: t.type as string,
			amount: t.amount as number,
			description: t.description as string | null,
			accountId: t.accountId as string,
			toAccountId: t.toAccountId as string | null,
			categoryId: t.categoryId as string | null,
			debtId: t.debtId as string | null,
			isTaxed: Boolean(t.isTaxed),
			taxAmount: (t.taxAmount as number) ?? 0,
			referenceNumber: t.referenceNumber as string | null,
			notes: t.notes as string | null,
			isActive: t.isActive !== undefined ? Boolean(t.isActive) : true,
			createdAt: parseDateToDate(t.createdAt as string | null | undefined),
			updatedAt: parseDateToDate(t.updatedAt as string | null | undefined)
		}));
		await db.insert(transaction).values(transactions);
	}

	// Insert debts
	if (backup.debts.length > 0) {
		const debts = backup.debts.map((d) => {
			const timestamps = {
				createdAt: parseDateToDate(d.createdAt as string | null | undefined),
				updatedAt: parseDateToDate(d.updatedAt as string | null | undefined)
			};
			return {
				id: d.id as string,
				userId,
				type: d.type as string,
				contactName: d.contactName as string,
				contactPhone: d.contactPhone as string | undefined,
				contactAddress: d.contactAddress as string | undefined,
				originalAmount: d.originalAmount as number,
				paidAmount: (d.paidAmount as number) ?? 0,
				remainingAmount: d.remainingAmount as number,
				date: d.date as string,
				dueDate: d.dueDate as string | undefined,
				description: d.description as string | undefined,
				status: d.status as string,
				isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
				...timestamps
			};
		});
		await db.insert(debt).values(debts);
	}

	// Insert debt payments
	if (backup.debtPayments.length > 0) {
		const payments = backup.debtPayments.map((dp) => ({
			id: dp.id as string,
			userId,
			debtId: dp.debtId as string,
			amount: dp.amount as number,
			date: dp.date as string,
			accountId: dp.accountId as string,
			transactionId: dp.transactionId as string | undefined,
			notes: dp.notes as string | undefined,
			createdAt: parseDateToDate(dp.createdAt as string | null | undefined)
		}));
		await db.insert(debtPayment).values(payments);
	}

	// Insert tax records
	if (backup.taxRecords.length > 0) {
		const records = backup.taxRecords.map((tr) => ({
			id: tr.id as string,
			userId,
			year: tr.year as number,
			month: tr.month as number,
			taxType: tr.taxType as string,
			taxableIncome: tr.taxableIncome as number,
			taxRate: tr.taxRate as number,
			taxAmount: tr.taxAmount as number,
			status: tr.status as string,
			billingCode: tr.billingCode as string | null,
			paymentDate: tr.paymentDate as string | null,
			notes: tr.notes as string | null,
			createdAt: parseDateToDate(tr.createdAt as string | null | undefined),
			updatedAt: parseDateToDate(tr.updatedAt as string | null | undefined)
		}));
		await db.insert(taxRecord).values(records);
	}

	// Insert transaction templates
	if (backup.templates.length > 0) {
		const templates = backup.templates.map((tpl) => ({
			id: tpl.id as string,
			userId,
			name: tpl.name as string,
			type: tpl.type as string,
			categoryId: tpl.categoryId as string | null,
			description: tpl.description as string | null,
			isSystem: Boolean(tpl.isSystem),
			isActive: tpl.isActive !== undefined ? Boolean(tpl.isActive) : true,
			createdAt: parseDateToDate(tpl.createdAt as string | null | undefined),
			updatedAt: parseDateToDate(tpl.updatedAt as string | null | undefined)
		}));
		await db.insert(transactionTemplate).values(templates);
	}

	// Insert transaction photo metadata (not actual files)
	if (backup.photos.length > 0) {
		const photos = backup.photos.map((p) => ({
			id: p.id as string,
			userId,
			transactionId: p.transactionId as string,
			fileName: p.fileName as string,
			fileSize: p.fileSize as number,
			mimeType: p.mimeType as string,
			r2Key: p.r2Key as string,
			r2Url: p.r2Url as string | null,
			caption: p.caption as string | null,
			createdAt: parseDateToDate(p.createdAt as string | null | undefined)
		}));
		await db.insert(transactionPhoto).values(photos);
	}
}

// POST /api/restore - Restore data from backup file
export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Get backup file from request
		const contentType = request.headers.get('content-type') ?? '';

		let backupData: unknown;

		if (contentType.includes('application/json')) {
			// Parse JSON directly
			const text = await request.text();
			backupData = JSON.parse(text);
		} else if (contentType.includes('multipart/form-data')) {
			// Handle multipart form data with file upload
			const formData = await request.formData();
			const file = formData.get('file') as File | null;

			if (!file) {
				return json({ error: 'File backup tidak ditemukan' }, { status: 400 });
			}

			const text = await file.text();
			backupData = JSON.parse(text);
		} else {
			return json({ error: 'Format request tidak didukung' }, { status: 400 });
		}

		// Validate backup data
		const validation = validateBackupData(backupData);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 400 });
		}

		console.log(`Starting restore for user ${userId}, schema version: ${validation.version}`);

		// Use transaction to ensure atomicity - if any step fails, rollback
		await db.transaction(async (tx) => {
			// Clear existing user data first
			await clearUserData(tx, userId);

			// Insert backup data
			await insertBackupData(tx, userId, backupData as Record<string, unknown>);
		});

		console.log(`Restore completed successfully for user ${userId}`);

		return json({
			success: true,
			message: 'Data berhasil dipulihkan dari backup'
		});
	} catch (error) {
		console.error('Error restoring backup:', error);

		if (error instanceof SyntaxError) {
			return json({ error: 'Format file backup tidak valid' }, { status: 400 });
		}

		return json({ error: 'Terjadi kesalahan saat memulihkan data' }, { status: 500 });
	}
};

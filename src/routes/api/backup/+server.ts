import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import {
	chartOfAccountQueries,
	categoryQueries,
	transactionQueries,
	debtQueries,
	taxRecordQueries,
	businessProfileQueries,
	transactionTemplateQueries
} from '$lib/server/db/queries';
import { APP_VERSION, BACKUP_SCHEMA_VERSION } from '$lib/constants';

// POST /api/backup - Generate and download backup file
export const POST: RequestHandler = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const db = getDb();

	try {
		// Query all user data in parallel for efficiency
		const [
			profiles,
			accounts,
			categories,
			transactions,
			debts,
			debtPayments,
			taxRecords,
			templates,
			photos
		] = await Promise.all([
			// Business profiles
			businessProfileQueries
				.findByUserId(db, userId)
				.then((p) => (Array.isArray(p) ? p : p ? [p] : [])),
			// Chart of accounts
			chartOfAccountQueries.findAll(db, userId),
			// Categories
			categoryQueries.findAll(db, userId),
			// Transactions
			transactionQueries.findAll(db, userId),
			// Debts
			debtQueries.findAll(db, userId),
			// Debt payments - use direct query as no query helper exists
			db.query.debtPayment.findMany({
				where: (table, { eq }) => eq(table.userId, userId)
			}),
			// Tax records
			taxRecordQueries.findAll(db, userId),
			// Transaction templates
			transactionTemplateQueries.findAll(db, userId),
			// Transaction photos (metadata only, not the actual files)
			db.query.transactionPhoto.findMany({
				where: (table, { eq }) => eq(table.userId, userId)
			})
		]);

		// Get business name from first profile for metadata
		const businessName = profiles[0]?.name ?? 'UMKM';

		// Build backup data structure
		const backupData = {
			// Metadata
			schemaVersion: BACKUP_SCHEMA_VERSION,
			appVersion: APP_VERSION,
			backupDate: new Date().toISOString(),
			businessName,

			// Business profiles
			businessProfiles: profiles.map((p) => ({
				id: p.id,
				name: p.name,
				address: p.address,
				phone: p.phone,
				npwp: p.npwp,
				businessType: p.businessType,
				ownerName: p.ownerName,
				industry: p.industry,
				createdAt: p.createdAt?.toISOString() ?? null,
				updatedAt: p.updatedAt?.toISOString() ?? null
			})),

			// Chart of accounts
			accounts: accounts.map((a) => ({
				id: a.id,
				code: a.code,
				name: a.name,
				type: a.type,
				subType: a.subType,
				isSystem: a.isSystem,
				isActive: a.isActive,
				parentId: a.parentId,
				balance: a.balance,
				createdAt: a.createdAt?.toISOString() ?? null,
				updatedAt: a.updatedAt?.toISOString() ?? null
			})),

			// Categories
			categories: categories.map((c) => ({
				id: c.id,
				code: c.code,
				name: c.name,
				type: c.type,
				isSystem: c.isSystem,
				isActive: c.isActive,
				icon: c.icon,
				color: c.color,
				createdAt: c.createdAt?.toISOString() ?? null,
				updatedAt: c.updatedAt?.toISOString() ?? null
			})),

			// Transactions
			transactions: transactions.map((t) => ({
				id: t.id,
				date: t.date,
				type: t.type,
				amount: t.amount,
				description: t.description,
				accountId: t.accountId,
				toAccountId: t.toAccountId,
				categoryId: t.categoryId,
				debtId: t.debtId,
				isTaxed: t.isTaxed,
				taxAmount: t.taxAmount,
				referenceNumber: t.referenceNumber,
				notes: t.notes,
				isActive: t.isActive,
				createdAt: t.createdAt?.toISOString() ?? null,
				updatedAt: t.updatedAt?.toISOString() ?? null
			})),

			// Debts
			debts: debts.map((d) => ({
				id: d.id,
				type: d.type,
				contactName: d.contactName,
				contactPhone: d.contactPhone,
				contactAddress: d.contactAddress,
				originalAmount: d.originalAmount,
				paidAmount: d.paidAmount,
				remainingAmount: d.remainingAmount,
				date: d.date,
				dueDate: d.dueDate,
				description: d.description,
				status: d.status,
				isActive: d.isActive,
				createdAt: d.createdAt?.toISOString() ?? null,
				updatedAt: d.updatedAt?.toISOString() ?? null
			})),

			// Debt payments
			debtPayments: debtPayments.map((dp) => ({
				id: dp.id,
				debtId: dp.debtId,
				amount: dp.amount,
				date: dp.date,
				accountId: dp.accountId,
				transactionId: dp.transactionId,
				notes: dp.notes,
				createdAt: dp.createdAt?.toISOString() ?? null
			})),

			// Tax records
			taxRecords: taxRecords.map((tr) => ({
				id: tr.id,
				year: tr.year,
				month: tr.month,
				taxType: tr.taxType,
				taxableIncome: tr.taxableIncome,
				taxRate: tr.taxRate,
				taxAmount: tr.taxAmount,
				status: tr.status,
				billingCode: tr.billingCode,
				paymentDate: tr.paymentDate,
				notes: tr.notes,
				createdAt: tr.createdAt?.toISOString() ?? null,
				updatedAt: tr.updatedAt?.toISOString() ?? null
			})),

			// Transaction templates
			templates: templates.map((tpl) => ({
				id: tpl.id,
				name: tpl.name,
				type: tpl.type,
				categoryId: tpl.categoryId,
				description: tpl.description,
				isSystem: tpl.isSystem,
				isActive: tpl.isActive,
				createdAt: tpl.createdAt?.toISOString() ?? null,
				updatedAt: tpl.updatedAt?.toISOString() ?? null
			})),

			// Transaction photo metadata (not the actual photos)
			photos: photos.map((p) => ({
				id: p.id,
				transactionId: p.transactionId,
				fileName: p.fileName,
				fileSize: p.fileSize,
				mimeType: p.mimeType,
				r2Key: p.r2Key,
				r2Url: p.r2Url,
				caption: p.caption,
				createdAt: p.createdAt?.toISOString() ?? null
			}))
		};

		// Calculate record count
		const recordCount =
			(accounts.length || 0) +
			(categories.length || 0) +
			(transactions.length || 0) +
			(debts.length || 0) +
			(debtPayments.length || 0) +
			(taxRecords.length || 0) +
			(templates.length || 0);

		console.log(
			`Backup generated for user ${userId}: ${recordCount} records, business: ${businessName}`
		);

		// Return JSON as downloadable file
		return new Response(JSON.stringify(backupData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="backup-${businessName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json"`
			}
		});
	} catch (error) {
		console.error('Error generating backup:', error);
		return json({ error: 'Terjadi kesalahan saat membuat cadangan' }, { status: 500 });
	}
};

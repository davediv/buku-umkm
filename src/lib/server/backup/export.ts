import { asc, eq } from 'drizzle-orm';
import { APP_VERSION } from '$lib/constants';
import type { SQLiteDb } from '$lib/server/db';
import {
	businessProfile,
	category,
	chartOfAccount,
	debt,
	debtPayment,
	onboardingState,
	taxProfile,
	taxRecord,
	transaction,
	transactionPhoto,
	transactionTemplate
} from '$lib/server/db/schema';
import {
	BACKUP_FORMAT,
	BACKUP_SCHEMA_VERSION,
	type BackupDocument,
	type BackupTimestamp
} from './format';

function iso(value: Date | null | undefined): BackupTimestamp {
	return value ? value.toISOString() : null;
}

/** Every row restore needs, as one read batch (one D1 query against the invocation limit). */
function readUserRows(db: SQLiteDb, userId: string) {
	return db.batch([
		db.select().from(businessProfile).where(eq(businessProfile.userId, userId)),
		db.select().from(onboardingState).where(eq(onboardingState.userId, userId)),
		db
			.select()
			.from(chartOfAccount)
			.where(eq(chartOfAccount.userId, userId))
			.orderBy(asc(chartOfAccount.code), asc(chartOfAccount.id)),
		db
			.select()
			.from(category)
			.where(eq(category.userId, userId))
			.orderBy(asc(category.code), asc(category.id)),
		// Deleted (inactive) rows too: payments, photos and loans may still point at them.
		db
			.select()
			.from(transaction)
			.where(eq(transaction.userId, userId))
			.orderBy(asc(transaction.date), asc(transaction.createdAt), asc(transaction.id)),
		db
			.select()
			.from(debt)
			.where(eq(debt.userId, userId))
			.orderBy(asc(debt.date), asc(debt.createdAt), asc(debt.id)),
		db
			.select()
			.from(debtPayment)
			.where(eq(debtPayment.userId, userId))
			.orderBy(asc(debtPayment.date), asc(debtPayment.createdAt), asc(debtPayment.id)),
		db
			.select()
			.from(taxProfile)
			.where(eq(taxProfile.userId, userId))
			.orderBy(asc(taxProfile.taxYear)),
		db
			.select()
			.from(taxRecord)
			.where(eq(taxRecord.userId, userId))
			.orderBy(asc(taxRecord.year), asc(taxRecord.month), asc(taxRecord.id)),
		db
			.select()
			.from(transactionTemplate)
			.where(eq(transactionTemplate.userId, userId))
			.orderBy(asc(transactionTemplate.name), asc(transactionTemplate.id)),
		db
			.select()
			.from(transactionPhoto)
			.where(eq(transactionPhoto.userId, userId))
			.orderBy(asc(transactionPhoto.createdAt), asc(transactionPhoto.id))
	]);
}

/**
 * The backup file for `userId`: every row restore needs, including deleted transactions
 * and debts and every loan column. The NPWP stays encrypted, and receipt images are not
 * included (only their metadata), which `contents` says for the UI.
 */
export async function buildBackupDocument(
	db: SQLiteDb,
	userId: string,
	now = new Date()
): Promise<BackupDocument> {
	const [
		profiles,
		[state],
		accounts,
		categories,
		transactions,
		debts,
		payments,
		taxProfiles,
		taxRecords,
		templates,
		photos
	] = await readUserRows(db, userId);

	return {
		format: BACKUP_FORMAT,
		schemaVersion: BACKUP_SCHEMA_VERSION,
		appVersion: APP_VERSION,
		backupDate: now.toISOString(),
		businessName: profiles[0]?.name ?? 'UMKM',
		contents: { photoImages: 'not_included', npwp: 'encrypted' },
		businessProfiles: profiles.map((item) => ({
			id: item.id,
			name: item.name,
			address: item.address,
			phone: item.phone,
			npwp: item.npwp,
			businessType: item.businessType,
			ownerName: item.ownerName,
			industry: item.industry,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		onboardingState: state
			? {
					status: state.status,
					completedAt: iso(state.completedAt),
					skippedAt: iso(state.skippedAt),
					createdAt: iso(state.createdAt),
					updatedAt: iso(state.updatedAt)
				}
			: null,
		accounts: accounts.map((item) => ({
			id: item.id,
			code: item.code,
			name: item.name,
			type: item.type,
			subType: item.subType,
			isSystem: item.isSystem,
			isActive: item.isActive,
			parentId: item.parentId,
			balance: item.balance,
			openingBalance: item.openingBalance,
			openingDate: item.openingDate,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		categories: categories.map((item) => ({
			id: item.id,
			code: item.code,
			name: item.name,
			type: item.type,
			isSystem: item.isSystem,
			isActive: item.isActive,
			icon: item.icon,
			color: item.color,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		transactions: transactions.map((item) => ({
			id: item.id,
			date: item.date,
			type: item.type,
			amount: item.amount,
			description: item.description,
			accountId: item.accountId,
			toAccountId: item.toAccountId,
			categoryId: item.categoryId,
			debtId: item.debtId,
			isTaxed: item.isTaxed,
			taxAmount: item.taxAmount,
			referenceNumber: item.referenceNumber,
			notes: item.notes,
			isActive: item.isActive,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		debts: debts.map((item) => ({
			id: item.id,
			type: item.type,
			kind: item.kind,
			principalAccountId: item.principalAccountId,
			principalTransactionId: item.principalTransactionId,
			contactName: item.contactName,
			contactPhone: item.contactPhone,
			contactAddress: item.contactAddress,
			originalAmount: item.originalAmount,
			paidAmount: item.paidAmount,
			remainingAmount: item.remainingAmount,
			date: item.date,
			dueDate: item.dueDate,
			description: item.description,
			status: item.status,
			isActive: item.isActive,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		debtPayments: payments.map((item) => ({
			id: item.id,
			debtId: item.debtId,
			amount: item.amount,
			date: item.date,
			accountId: item.accountId,
			transactionId: item.transactionId,
			notes: item.notes,
			createdAt: iso(item.createdAt)
		})),
		taxProfiles: taxProfiles.map((item) => ({
			id: item.id,
			taxYear: item.taxYear,
			legalForm: item.legalForm,
			registeredAt: item.registeredAt,
			finalRegimeStartYear: item.finalRegimeStartYear,
			regimeChoice: item.regimeChoice,
			everUsedGeneralRegime: item.everUsedGeneralRegime,
			turnoverLimitExceeded: item.turnoverLimitExceeded,
			priorYearAggregatedRevenue: item.priorYearAggregatedRevenue,
			externalMonthlyRevenue: item.externalMonthlyRevenue,
			revenueDataComplete: item.revenueDataComplete,
			aggregationConfirmed: item.aggregationConfirmed,
			hasProfessionalServiceIncome: item.hasProfessionalServiceIncome,
			soleOwnerProvidesProfessionalServices: item.soleOwnerProvidesProfessionalServices,
			usesOtherTaxFacility: item.usesOtherTaxFacility,
			groupTurnoverExceeded: item.groupTurnoverExceeded,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		taxRecords: taxRecords.map((item) => ({
			id: item.id,
			year: item.year,
			month: item.month,
			taxType: item.taxType,
			taxableIncome: item.taxableIncome,
			taxRate: item.taxRate,
			taxAmount: item.taxAmount,
			paidAmount: item.paidAmount,
			status: item.status,
			billingCode: item.billingCode,
			paymentDate: item.paymentDate,
			notes: item.notes,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		templates: templates.map((item) => ({
			id: item.id,
			name: item.name,
			type: item.type,
			categoryId: item.categoryId,
			description: item.description,
			isSystem: item.isSystem,
			isActive: item.isActive,
			createdAt: iso(item.createdAt),
			updatedAt: iso(item.updatedAt)
		})),
		photos: photos.map((item) => ({
			id: item.id,
			transactionId: item.transactionId,
			fileName: item.fileName,
			fileSize: item.fileSize,
			mimeType: item.mimeType,
			r2Key: item.r2Key,
			caption: item.caption,
			createdAt: iso(item.createdAt)
		}))
	};
}

/** Rows in a backup document, as restore counts them against MAX_RESTORE_ROWS. */
export function backupRowCount(document: BackupDocument): number {
	return (
		document.businessProfiles.length +
		document.accounts.length +
		document.categories.length +
		document.transactions.length +
		document.debts.length +
		document.debtPayments.length +
		document.taxProfiles.length +
		document.taxRecords.length +
		document.templates.length +
		document.photos.length
	);
}

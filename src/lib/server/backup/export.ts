import { asc, eq } from 'drizzle-orm';
import { APP_VERSION } from '#lib/constants.ts';
import type { SQLiteDb } from '#lib/server/db/index.ts';
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
} from '#lib/server/db/schema.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import {
	findReceiptObjects,
	isOwnReceiptKey,
	receiptMimeType
} from '#lib/server/photos/receipts.ts';
import { createZipStream, type ZipEntrySource } from '#lib/shared/zip.ts';
import {
	BACKUP_DOCUMENT_ENTRY,
	BACKUP_FORMAT,
	BACKUP_SCHEMA_VERSION,
	MAX_BACKUP_ARCHIVE_BYTES,
	MAX_BACKUP_BYTES,
	MAX_RESTORE_ROWS,
	photoEntryName,
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
 * The backup document for `userId`: every row restore needs, including deleted
 * transactions and debts and every loan column. The NPWP stays encrypted. Photos carry
 * only their metadata here; buildBackupArchive adds the images.
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
			interestAmount: item.interestAmount,
			date: item.date,
			accountId: item.accountId,
			transactionId: item.transactionId,
			interestTransactionId: item.interestTransactionId,
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
			image: null,
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

export type BackupArchive = {
	schemaVersion: string;
	businessName: string;
	/** Photo rows in the backup. */
	photoCount: number;
	/** Photos whose image was not in storage, so only their metadata is in the archive. */
	photosWithoutImage: number;
	/**
	 * What /api/restore takes in one request: the whole archive, only its backup.json (the
	 * archive is over MAX_BACKUP_ARCHIVE_BYTES; the page can send the document alone), or
	 * neither (too many rows, or a document over MAX_BACKUP_BYTES).
	 */
	restorable: 'all' | 'data-only' | 'none';
	/** The .zip, built as it is read. */
	stream: ReadableStream<Uint8Array>;
};

type ArchiveImage = { key: string; entry: string; size: number };

/** A ZIP entry's local header, central record and name twice ($lib/shared/zip.ts). */
const entryOverhead = (name: string) => 30 + 46 + 2 * name.length;
const END_RECORD_BYTES = 22;

/**
 * backup.json, then each image read from R2 one at a time as the archive is pulled, so a
 * download holds about one image however many there are.
 */
async function* archiveEntries(
	pending: { json: Uint8Array<ArrayBuffer> | null },
	images: ArchiveImage[],
	receipts: Pick<R2Bucket, 'get'> | null
): AsyncGenerator<ZipEntrySource> {
	try {
		yield { name: BACKUP_DOCUMENT_ENTRY, data: pending.json!, compress: true };
		// Up to 10 MB: not held while the images stream.
		pending.json = null;
		if (!receipts) return;
		for (const image of images) {
			const object = await receipts.get(image.key);
			// Deleted since it was listed: restore counts the photo as dropped.
			if (object) yield { name: image.entry, data: new Uint8Array(await object.arrayBuffer()) };
		}
	} catch (error) {
		// The response has started by now; the download ends without a central directory.
		console.error('Backup archive failed while streaming', summarizeError(error));
		throw error;
	}
}

/**
 * The .zip backup for `userId`: backup.json, then every photo's image still in the user's
 * storage, each named in its photo's `image`. Which images exist (and their sizes) is
 * listed up front, so the document and the restorable estimate are settled before the
 * first byte; the images themselves are read only as the stream is consumed.
 */
export async function buildBackupArchive(
	db: SQLiteDb,
	userId: string,
	receipts: Pick<R2Bucket, 'list' | 'get'> | null,
	now = new Date()
): Promise<BackupArchive> {
	const document = await buildBackupDocument(db, userId, now);

	const named = new Map<string, { key: string; entry: string }>();
	for (const photo of document.photos) {
		const type = isOwnReceiptKey(userId, photo.r2Key) ? receiptMimeType(photo.r2Key) : null;
		const entry = type && photoEntryName(photo.id, type === 'image/png' ? 'png' : 'jpg');
		if (entry) named.set(photo.id, { key: photo.r2Key, entry });
	}
	const sizes =
		receipts && named.size > 0
			? await findReceiptObjects(receipts, userId, new Set([...named.values()].map((n) => n.key)))
			: new Map<string, number>();

	const images: ArchiveImage[] = [];
	for (const photo of document.photos) {
		const image = named.get(photo.id);
		const size = image && sizes.get(image.key);
		if (image && size !== undefined) {
			photo.image = image.entry;
			images.push({ ...image, size });
		}
	}
	document.contents.photoImages = 'included';

	const json = new TextEncoder().encode(JSON.stringify(document));
	// The document counted uncompressed: an upper bound, so "all" is never promised wrongly.
	const archiveBytes = images.reduce(
		(total, image) => total + entryOverhead(image.entry) + image.size,
		entryOverhead(BACKUP_DOCUMENT_ENTRY) + json.byteLength + END_RECORD_BYTES
	);
	const dataFits =
		json.byteLength <= MAX_BACKUP_BYTES && backupRowCount(document) <= MAX_RESTORE_ROWS;

	return {
		schemaVersion: document.schemaVersion,
		businessName: document.businessName,
		photoCount: document.photos.length,
		photosWithoutImage: document.photos.length - images.length,
		restorable: !dataFits ? 'none' : archiveBytes <= MAX_BACKUP_ARCHIVE_BYTES ? 'all' : 'data-only',
		// DOS times carry no zone; WIB is how the owner reads them.
		stream: createZipStream(archiveEntries({ json }, images, receipts), {
			modified: now,
			utcOffsetMinutes: 7 * 60
		})
	};
}

import { and, eq } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import { chunkedInserts, runBatch } from '$lib/server/db/batch';
import {
	businessProfile,
	category,
	chartOfAccount,
	debt,
	debtPayment,
	financialCommand,
	onboardingState,
	taxProfile,
	taxRecord,
	transaction,
	transactionPhoto,
	transactionTemplate
} from '$lib/server/db/schema';
import { decryptNPWP, validateNPWP } from '$lib/server/crypto';
import { summarizeError } from '$lib/server/error-summary';
import {
	findReceiptObjects,
	imageExtension,
	isOwnReceiptKey,
	MAX_PHOTOS_PER_TRANSACTION,
	MAX_RECEIPT_BYTES,
	receiptKey,
	receiptMimeType,
	receiptUrl
} from '$lib/server/photos/receipts';
import { readZip, ZipError, type ZipEntry, type ZipReadLimits } from '$lib/shared/zip';
import {
	BACKUP_DOCUMENT_ENTRY,
	MAX_BACKUP_ARCHIVE_BYTES,
	MAX_BACKUP_BYTES,
	MAX_RESTORE_ROWS,
	PHOTO_ENTRY_PATTERN
} from './format';
import { BackupError, parseBackup, type PhotoCandidate, type RestorePlan } from './parse';

type NewPhoto = typeof transactionPhoto.$inferInsert;

export type RestoreSummary = {
	schemaVersion: string;
	restored: {
		businessProfile: number;
		accounts: number;
		categories: number;
		transactions: number;
		debts: number;
		debtPayments: number;
		taxProfiles: number;
		taxRecords: number;
		templates: number;
		photos: number;
	};
	/** Photo rows not restored: their image is not in the archive (or, for a .json file, in
	 * this account's storage), is not a JPEG or PNG, or is over the 3-per-transaction cap. */
	photosDropped: number;
	/** The backup's NPWP could not be decrypted here (another deployment's key) and was left out. */
	npwpDropped: boolean;
};

export type RestoreOptions = {
	/** The receipts bucket. Without it no photo can be verified, so none is restored. */
	receipts?: Pick<R2Bucket, 'list'> | null;
	decryptNpwp?: (ciphertext: string) => Promise<string | null>;
};

export type ArchiveRestoreOptions = {
	/** The receipts bucket. Without it no image can be stored, so no photo is restored. */
	receipts?: Pick<R2Bucket, 'put' | 'delete'> | null;
	decryptNpwp?: (ciphertext: string) => Promise<string | null>;
	/** Keeps a failed restore's cleanup running if the client goes away (ctx.waitUntil). */
	waitUntil?: (promise: Promise<unknown>) => void;
};

/** Keeps the NPWP ciphertext only if this deployment's key opens it to a valid NPWP. */
async function resolveNpwp(
	ciphertext: string | null | undefined,
	decrypt: (value: string) => Promise<string | null>
): Promise<{ npwp: string | null; dropped: boolean }> {
	if (!ciphertext) return { npwp: null, dropped: false };
	const plain = await decrypt(ciphertext).catch(() => null);
	if (!plain || !validateNPWP(plain).valid) return { npwp: null, dropped: true };
	return { npwp: ciphertext, dropped: false };
}

/** Admits at most MAX_PHOTOS_PER_TRANSACTION photos per transaction, as the upload route does. */
function photoCap(): (transactionId: string) => boolean {
	const counts = new Map<string, number>();
	return (transactionId) => {
		const count = counts.get(transactionId) ?? 0;
		if (count >= MAX_PHOTOS_PER_TRANSACTION) return false;
		counts.set(transactionId, count + 1);
		return true;
	};
}

function photoRow(item: PhotoCandidate, userId: string, key: string, fileSize: number): NewPhoto {
	return {
		id: item.id,
		userId,
		transactionId: item.transactionId,
		fileName: item.fileName,
		fileSize,
		mimeType: receiptMimeType(key)!,
		r2Key: key,
		r2Url: receiptUrl(key),
		caption: item.caption,
		createdAt: item.createdAt
	};
}

/**
 * For a .json file, a photo row survives only when the image it names is already in the
 * caller's own R2 prefix (a backup restored to the account that made it). Its key, URL,
 * size and type then come from R2, never from the file, so a crafted backup cannot point
 * a row at another user's object and later delete it. The object keeps its key: R2
 * cannot rename, and copying images around would make the restore non-atomic.
 */
async function resolvePhotos(
	candidates: PhotoCandidate[],
	userId: string,
	receipts: Pick<R2Bucket, 'list'> | null | undefined
): Promise<NewPhoto[]> {
	const eligible = candidates.filter(
		(item) => isOwnReceiptKey(userId, item.claimedKey) && receiptMimeType(item.claimedKey)
	);
	if (!receipts || eligible.length === 0) return [];

	const found = await findReceiptObjects(
		receipts,
		userId,
		new Set(eligible.map((item) => item.claimedKey))
	);
	const usedKeys = new Set<string>();
	const admit = photoCap();
	const rows: NewPhoto[] = [];
	for (const item of eligible) {
		const size = found.get(item.claimedKey);
		if (size === undefined || usedKeys.has(item.claimedKey) || !admit(item.transactionId)) {
			continue;
		}
		usedKeys.add(item.claimedKey);
		rows.push(photoRow(item, userId, item.claimedKey, size));
	}
	return rows;
}

/**
 * Replaces everything `userId` owns with a validated plan and its photo rows: the deletes
 * and every insert run as one D1 batch, so a restore lands completely or not at all.
 */
async function commitRestore(
	db: SQLiteDb,
	userId: string,
	plan: RestorePlan,
	photos: NewPhoto[],
	decrypt: (ciphertext: string) => Promise<string | null> = decryptNPWP
): Promise<RestoreSummary> {
	const { npwp, dropped: npwpDropped } = await resolveNpwp(plan.businessProfile?.npwp, decrypt);
	const profile = plan.businessProfile ? { ...plan.businessProfile, npwp } : null;
	// debt.principalTransactionId and transaction.debtId point at each other: insert the
	// debts unlinked, then the transactions, then link the loans to their principal.
	const loanLinks = plan.debts.filter((item) => item.principalTransactionId);
	const now = new Date();

	await runBatch(db, [
		// Children before parents. Rows of other users are never touched.
		db.delete(transactionPhoto).where(eq(transactionPhoto.userId, userId)),
		db.delete(debtPayment).where(eq(debtPayment.userId, userId)),
		db.delete(transaction).where(eq(transaction.userId, userId)),
		db.delete(debt).where(eq(debt.userId, userId)),
		db.delete(transactionTemplate).where(eq(transactionTemplate.userId, userId)),
		db.delete(taxRecord).where(eq(taxRecord.userId, userId)),
		db.delete(taxProfile).where(eq(taxProfile.userId, userId)),
		db.delete(category).where(eq(category.userId, userId)),
		db.delete(chartOfAccount).where(eq(chartOfAccount.userId, userId)),
		db.delete(businessProfile).where(eq(businessProfile.userId, userId)),
		// Idempotency keys name entities that no longer exist after a restore.
		db.delete(financialCommand).where(eq(financialCommand.userId, userId)),
		// Restored books are set up: without a state in the file (1.x), keep the caller's,
		// or mark onboarding done so it never seeds a second set of accounts.
		...(plan.onboardingState
			? [
					db.delete(onboardingState).where(eq(onboardingState.userId, userId)),
					db.insert(onboardingState).values(plan.onboardingState)
				]
			: [
					db
						.insert(onboardingState)
						.values({ userId, status: 'completed', completedAt: now, skippedAt: null })
						.onConflictDoNothing()
				]),
		...(profile ? [db.insert(businessProfile).values(profile)] : []),
		...chunkedInserts(db, chartOfAccount, plan.accounts),
		...chunkedInserts(db, category, plan.categories),
		...chunkedInserts(
			db,
			debt,
			plan.debts.map((item) => ({ ...item, principalTransactionId: null }))
		),
		...chunkedInserts(db, transaction, plan.transactions),
		...loanLinks.map((item) =>
			db
				.update(debt)
				.set({ principalTransactionId: item.principalTransactionId, updatedAt: item.updatedAt })
				.where(and(eq(debt.userId, userId), eq(debt.id, item.id!)))
		),
		...chunkedInserts(db, debtPayment, plan.payments),
		...chunkedInserts(db, taxProfile, plan.taxProfiles),
		...chunkedInserts(db, taxRecord, plan.taxRecords),
		...chunkedInserts(db, transactionTemplate, plan.templates),
		...chunkedInserts(db, transactionPhoto, photos)
	]);

	return {
		schemaVersion: plan.schemaVersion,
		restored: {
			businessProfile: profile ? 1 : 0,
			accounts: plan.accounts.length,
			categories: plan.categories.length,
			transactions: plan.transactions.length,
			debts: plan.debts.length,
			debtPayments: plan.payments.length,
			taxProfiles: plan.taxProfiles.length,
			taxRecords: plan.taxRecords.length,
			templates: plan.templates.length,
			photos: photos.length
		},
		photosDropped: plan.photosWithoutTransaction + plan.photoCandidates.length - photos.length,
		npwpDropped
	};
}

/**
 * Replaces everything `userId` owns with the contents of a parsed backup file (.json). The
 * file is validated in full first (BackupError on the first problem); photos come back
 * only if their images are still in the caller's storage.
 */
export async function restoreBackup(
	db: SQLiteDb,
	userId: string,
	file: unknown,
	options: RestoreOptions = {}
): Promise<RestoreSummary> {
	const plan = parseBackup(file, userId);
	const photos = await resolvePhotos(plan.photoCandidates, userId, options.receipts);
	return commitRestore(db, userId, plan, photos, options.decryptNpwp);
}

const USE_ORIGINAL_ARCHIVE = 'Gunakan file .zip asli yang diunduh dari Buku UMKM.';

const ARCHIVE_LIMITS: ZipReadLimits = {
	maxArchiveBytes: MAX_BACKUP_ARCHIVE_BYTES,
	maxEntries: 1 + MAX_RESTORE_ROWS,
	maxEntryBytes(name) {
		if (name === BACKUP_DOCUMENT_ENTRY) return MAX_BACKUP_BYTES;
		if (PHOTO_ENTRY_PATTERN.test(name)) return MAX_RECEIPT_BYTES;
		throw new BackupError(
			`File .zip berisi file lain selain backup dan foto nota. ${USE_ORIGINAL_ARCHIVE}`
		);
	},
	// Images are stored as is, so the archive bounds them; the document inflates up to its limit.
	maxTotalBytes: MAX_BACKUP_ARCHIVE_BYTES + MAX_BACKUP_BYTES
};

/** What the owner is told about an archive the reader refused. */
function archiveError(error: ZipError): BackupError {
	switch (error.code) {
		case 'limit':
			return new BackupError(
				`File backup .zip melebihi batas pemulihan: maks ${MAX_BACKUP_ARCHIVE_BYTES / 1024 / 1024} MB, dengan backup.json maks ${MAX_BACKUP_BYTES / 1024 / 1024} MB dan tiap foto maks ${MAX_RECEIPT_BYTES / 1024} KB.`,
				413,
				'BACKUP_TOO_LARGE'
			);
		case 'truncated':
			return new BackupError(
				`File backup .zip tidak lengkap; unduhan atau unggahannya mungkin terputus. ${USE_ORIGINAL_ARCHIVE}`
			);
		case 'corrupt':
			return new BackupError(`File backup .zip rusak. ${USE_ORIGINAL_ARCHIVE}`);
		default:
			// Re-compressed archives (data descriptors, other tools' extras) land here.
			return new BackupError(
				`File .zip ini tidak dibuat oleh Buku UMKM atau sudah dikompres ulang. ${USE_ORIGINAL_ARCHIVE}`
			);
	}
}

/** The archive's first entry, the backup document, validated in full into a plan. */
async function readArchivePlan(
	entries: AsyncGenerator<ZipEntry, void, undefined>,
	userId: string
): Promise<RestorePlan> {
	const first = await entries.next();
	if (first.done || first.value.name !== BACKUP_DOCUMENT_ENTRY) {
		throw new BackupError(`File .zip ini tidak berisi backup Buku UMKM. ${USE_ORIGINAL_ARCHIVE}`);
	}
	let file: unknown;
	try {
		file = JSON.parse(new TextDecoder().decode(first.value.data));
	} catch {
		throw new BackupError('File backup bukan JSON yang valid');
	}
	return parseBackup(file, userId);
}

/**
 * Stores each photo image the plan names, as it streams in, under a fresh key in the
 * caller's prefix. The bytes decide the type: an entry that is not the JPEG or PNG its
 * name says is dropped, as is a photo past the per-transaction cap. Every key is added
 * to `stored` before its put, so a failed restore can delete it again.
 */
async function storeArchivePhotos(
	entries: AsyncGenerator<ZipEntry, void, undefined>,
	plan: RestorePlan,
	userId: string,
	receipts: Pick<R2Bucket, 'put'> | null | undefined,
	stored: string[]
): Promise<NewPhoto[]> {
	const candidates = new Map(
		plan.photoCandidates.flatMap((item) => (item.image ? [[item.image, item] as const] : []))
	);
	const admit = photoCap();
	const rows: NewPhoto[] = [];
	for await (const entry of entries) {
		const candidate = candidates.get(entry.name);
		const extension = imageExtension(entry.data);
		if (!receipts || !candidate || !extension || !entry.name.endsWith(`.${extension}`)) continue;
		if (!admit(candidate.transactionId)) continue;

		const key = receiptKey(userId, candidate.transactionId, candidate.id, extension);
		stored.push(key);
		await receipts.put(key, entry.data, { httpMetadata: { contentType: receiptMimeType(key)! } });
		rows.push(photoRow(candidate, userId, key, entry.data.byteLength));
	}
	return rows;
}

/** Deletes what a failed restore stored, at most 1000 keys per call as R2 allows. */
async function deleteStored(receipts: Pick<R2Bucket, 'delete'>, keys: string[]): Promise<void> {
	try {
		for (let at = 0; at < keys.length; at += 1000) await receipts.delete(keys.slice(at, at + 1000));
	} catch (error) {
		console.error(
			`Orphaned ${keys.length} receipt objects after a failed restore`,
			summarizeError(error)
		);
	}
}

/**
 * Replaces everything `userId` owns with a .zip backup read from `body` as it streams in:
 * backup.json is validated in full before anything is stored, then each image goes to R2
 * under a fresh key, and the single D1 batch runs only once the archive has been read to
 * its end and checked. If anything fails (a damaged or truncated archive, R2, the batch),
 * the images this call stored are deleted again and nothing else has changed.
 */
export async function restoreBackupArchive(
	db: SQLiteDb,
	userId: string,
	body: ReadableStream<Uint8Array>,
	options: ArchiveRestoreOptions = {}
): Promise<RestoreSummary> {
	const entries = readZip(body, ARCHIVE_LIMITS);
	const stored: string[] = [];
	try {
		const plan = await readArchivePlan(entries, userId);
		const photos = await storeArchivePhotos(entries, plan, userId, options.receipts, stored);
		return await commitRestore(db, userId, plan, photos, options.decryptNpwp);
	} catch (error) {
		if (options.receipts && stored.length > 0) {
			const cleanup = deleteStored(options.receipts, stored);
			options.waitUntil?.(cleanup);
			await cleanup;
		}
		throw error instanceof ZipError ? archiveError(error) : error;
	} finally {
		// Stops reading a body left unread by an early failure.
		await entries.return(undefined);
	}
}

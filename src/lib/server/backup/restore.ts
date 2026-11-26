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
import {
	findReceiptObjects,
	isOwnReceiptKey,
	MAX_PHOTOS_PER_TRANSACTION,
	receiptMimeType,
	receiptUrl
} from '$lib/server/photos/receipts';
import { parseBackup, type PhotoCandidate } from './parse';

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
	/** Photo rows not restored: their image is not in this account's storage. */
	photosDropped: number;
	/** The backup's NPWP could not be decrypted here (another deployment's key) and was left out. */
	npwpDropped: boolean;
};

export type RestoreOptions = {
	/** The receipts bucket. Without it no photo can be verified, so none is restored. */
	receipts?: Pick<R2Bucket, 'list'> | null;
	decryptNpwp?: (ciphertext: string) => Promise<string | null>;
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

/**
 * A photo row survives only when the image it names is already in the caller's own R2
 * prefix (a backup restored to the account that made it). Its key, URL, size and type
 * then come from R2, never from the file, so a crafted backup cannot point a row at
 * another user's object and later delete it. The object keeps its key: R2 cannot rename,
 * and copying images around would make the restore non-atomic.
 */
async function resolvePhotos(
	candidates: PhotoCandidate[],
	userId: string,
	receipts: Pick<R2Bucket, 'list'> | null | undefined
): Promise<(typeof transactionPhoto.$inferInsert)[]> {
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
	const perTransaction = new Map<string, number>();
	const rows: (typeof transactionPhoto.$inferInsert)[] = [];
	for (const item of eligible) {
		const size = found.get(item.claimedKey);
		const count = perTransaction.get(item.transactionId) ?? 0;
		if (size === undefined || usedKeys.has(item.claimedKey)) continue;
		if (count >= MAX_PHOTOS_PER_TRANSACTION) continue;
		usedKeys.add(item.claimedKey);
		perTransaction.set(item.transactionId, count + 1);
		rows.push({
			id: item.id,
			userId,
			transactionId: item.transactionId,
			fileName: item.fileName,
			fileSize: size,
			mimeType: receiptMimeType(item.claimedKey)!,
			r2Key: item.claimedKey,
			r2Url: receiptUrl(item.claimedKey),
			caption: item.caption,
			createdAt: item.createdAt
		});
	}
	return rows;
}

/**
 * Replaces everything `userId` owns with the contents of a parsed backup file. The file
 * is validated in full first (BackupError on the first problem), then the deletes and
 * every insert run as one D1 batch, so a restore either lands completely or not at all.
 */
export async function restoreBackup(
	db: SQLiteDb,
	userId: string,
	file: unknown,
	options: RestoreOptions = {}
): Promise<RestoreSummary> {
	const plan = parseBackup(file, userId);

	const [{ npwp, dropped: npwpDropped }, photos] = await Promise.all([
		resolveNpwp(plan.businessProfile?.npwp, options.decryptNpwp ?? decryptNPWP),
		resolvePhotos(plan.photoCandidates, userId, options.receipts)
	]);
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

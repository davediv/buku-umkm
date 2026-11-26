import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import { verification } from '$lib/server/db/schema';
import { summarizeError } from '$lib/server/error-summary';

/**
 * Account deletion, wired into better-auth's `user.deleteUser` (see $lib/server/auth).
 *
 * better-auth checks the password, then deletes the user row with its sessions and credential
 * account; every business table references `user` with ON DELETE CASCADE, so D1 removes all of
 * the user's books in the same statement (proved by deletion.d1.test.ts). What D1 cannot reach
 * are the receipt photos in R2, which are deleted here first: if that fails the account is left
 * whole, signed in, and the user can simply try again.
 */

/** The R2 calls deletion needs; an R2Bucket binding satisfies it. */
export interface ReceiptBucket {
	list(options: { prefix: string; limit: number }): Promise<{ objects: { key: string }[] }>;
	delete(keys: string[]): Promise<void>;
}

export interface AccountDeletionDeps {
	getBucket(): ReceiptBucket | undefined;
	getDb(): SQLiteDb;
}

/** R2 lists at most 1000 objects per call and deletes at most 1000 keys per call. */
const R2_PAGE_SIZE = 1000;

export const RECEIPTS_NOT_DELETED = 'RECEIPTS_NOT_DELETED';

/** Where a user's receipt photos live: receipts/<userId>/<transactionId>/<photoId>.<ext>. */
export function userReceiptPrefix(userId: string): string {
	// An empty or slash-containing id would widen the prefix to other users' photos.
	if (!userId || userId.includes('/')) throw new Error('Refusing an unsafe receipt prefix');
	return `receipts/${userId}/`;
}

/**
 * Deletes every R2 object under the user's receipt prefix, a page at a time, and returns how
 * many it deleted. Each pass lists from the start because the previous page is gone by then.
 * Throws if R2 fails; whatever is left is deleted by the next attempt.
 */
export async function deleteUserReceipts(bucket: ReceiptBucket, userId: string): Promise<number> {
	const prefix = userReceiptPrefix(userId);
	let deleted = 0;
	let previousFirstKey: string | undefined;
	for (;;) {
		const { objects } = await bucket.list({ prefix, limit: R2_PAGE_SIZE });
		if (objects.length === 0) return deleted;
		if (objects[0].key === previousFirstKey) {
			throw new Error('R2 listed receipt photos that it had just deleted');
		}
		previousFirstKey = objects[0].key;
		await bucket.delete(objects.map((object) => object.key));
		deleted += objects.length;
	}
}

/** better-auth `user.deleteUser` options: enabled, with the R2 and cleanup hooks. */
export function deleteUserOptions(deps: AccountDeletionDeps) {
	return {
		enabled: true,
		async beforeDelete(user: { id: string }) {
			const bucket = deps.getBucket();
			try {
				if (!bucket) throw new Error('The R2 receipt bucket binding is not configured');
				await deleteUserReceipts(bucket, user.id);
			} catch (cause) {
				console.error(
					'Account not deleted: receipt photos could not be deleted',
					summarizeError(cause)
				);
				throw new APIError('SERVICE_UNAVAILABLE', {
					code: RECEIPTS_NOT_DELETED,
					message: 'Foto nota belum dapat dihapus, jadi akun belum dihapus. Coba lagi.'
				});
			}
		},
		// The account is gone by now, so nothing here may fail the request.
		async afterDelete(user: { id: string }) {
			// A photo upload that finished while the account was being deleted.
			const bucket = deps.getBucket();
			if (bucket) {
				try {
					await deleteUserReceipts(bucket, user.id);
				} catch (cause) {
					console.error(
						`Receipt photos may remain under ${userReceiptPrefix(user.id)} after account deletion`,
						summarizeError(cause)
					);
				}
			}
			// Unused password reset tokens, which hold the deleted user's id.
			try {
				await deps.getDb().delete(verification).where(eq(verification.value, user.id));
			} catch (cause) {
				console.error('Reset tokens of a deleted account were not removed', summarizeError(cause));
			}
		}
	};
}

import { eq } from 'drizzle-orm';
import type { SQLiteDb } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';

/**
 * Completing a password reset proves the user reads the account's address, so the
 * address counts as verified from then on (better-auth's onPasswordReset hook).
 */
export async function markEmailVerifiedAfterReset(
	db: SQLiteDb,
	resetUser: { id: string; emailVerified: boolean }
): Promise<void> {
	if (resetUser.emailVerified) return;
	await db
		.update(user)
		.set({ emailVerified: true, updatedAt: new Date() })
		.where(eq(user.id, resetUser.id));
}

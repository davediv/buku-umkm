import { and, eq, notExists, or } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import { chartOfAccount, transaction } from '$lib/server/db/schema';

export type AccountDeactivation =
	'deactivated' | 'not_found' | 'already_inactive' | 'has_balance' | 'has_transactions';

/**
 * Hides an account from new entries. Deactivating never removes money from the books:
 * reports keep counting inactive accounts, and only an account holding Rp0 with no
 * transactions may be deactivated. The checks and the update are one statement, so a
 * transaction or transfer recorded meanwhile cannot slip past them.
 */
export async function deactivateAccount(
	db: SQLiteDb,
	userId: string,
	accountId: string
): Promise<AccountDeactivation> {
	const linkedTransactions = db
		.select({ id: transaction.id })
		.from(transaction)
		.where(
			and(
				eq(transaction.userId, userId),
				or(eq(transaction.accountId, accountId), eq(transaction.toAccountId, accountId))
			)
		);
	const [updated] = await db
		.update(chartOfAccount)
		.set({ isActive: false })
		.where(
			and(
				eq(chartOfAccount.userId, userId),
				eq(chartOfAccount.id, accountId),
				eq(chartOfAccount.isActive, true),
				eq(chartOfAccount.balance, 0),
				notExists(linkedTransactions)
			)
		)
		.returning({ id: chartOfAccount.id });
	if (updated) return 'deactivated';

	const current = await db.query.chartOfAccount.findFirst({
		where: (account, { and, eq }) => and(eq(account.userId, userId), eq(account.id, accountId)),
		columns: { isActive: true, balance: true }
	});
	if (!current) return 'not_found';
	if (!current.isActive) return 'already_inactive';
	if (current.balance !== 0) return 'has_balance';
	return 'has_transactions';
}

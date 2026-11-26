import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { SQLiteDb } from '$lib/server/db';
import { financeGuard } from '$lib/server/db/schema';

/** D1 rejects statements that bind more than 100 parameters. */
export const D1_MAX_BOUND_PARAMETERS = 100;

/** Message raised by the finance_guard trigger (drizzle/0006) when a batch guard fails. */
export const GUARD_FAILURE = 'BUKU_GUARD_FAILED';

type Statement = BatchItem<'sqlite'>;

/**
 * Runs statements as one D1 batch. D1 executes a batch as a single transaction,
 * so either every statement commits or none does. D1 rejects BEGIN/SAVEPOINT,
 * which is why Drizzle's `db.transaction()` cannot be used here.
 */
export async function runBatch(db: SQLiteDb, statements: Statement[]): Promise<void> {
	if (statements.length === 0) return;
	await db.batch(statements as [Statement, ...Statement[]]);
}

/**
 * A batch statement that aborts the whole batch unless `condition` holds when it runs.
 * Put it before the writes it protects: D1 runs batch statements in order inside one
 * transaction, so the check and the writes cannot interleave with another request.
 */
export function batchGuard(db: SQLiteDb, condition: SQL): Statement {
	// An insert builder rather than db.run(): Drizzle's D1 batch cannot bind
	// parameters for raw statements.
	return db.insert(financeGuard).values({ ok: sql`case when ${condition} then 1 else 0 end` });
}

/** True when an error (or any error in its cause chain) came from a failed batch guard. */
export function isGuardFailure(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth++) {
		if (current instanceof Error && current.message.includes(GUARD_FAILURE)) return true;
		current = current instanceof Error ? current.cause : undefined;
	}
	return false;
}

/**
 * Splits a multi-row insert into statements that each stay under D1's bound-parameter
 * limit. Drizzle binds at most one parameter per column per row.
 */
export function chunkedInserts<TTable extends SQLiteTable>(
	db: SQLiteDb,
	table: TTable,
	rows: TTable['$inferInsert'][]
): Statement[] {
	const columnCount = Object.keys(getTableColumns(table)).length;
	const rowsPerStatement = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMETERS / columnCount));
	const statements: Statement[] = [];
	for (let start = 0; start < rows.length; start += rowsPerStatement) {
		statements.push(db.insert(table).values(rows.slice(start, start + rowsPerStatement)));
	}
	return statements;
}

import { db, generateId, now } from './index';
import type { DebtRecord, DebtPaymentRecord, SyncStatus } from './schema';

// ============================================================================
// Debt CRUD Operations
// ============================================================================

export interface CreateDebtInput {
	userId: string;
	type: 'piutang' | 'hutang';
	contactName: string;
	contactPhone?: string;
	contactAddress?: string;
	originalAmount: number;
	date: string;
	dueDate?: string;
	description?: string;
}

export interface UpdateDebtInput {
	contactName?: string;
	contactPhone?: string;
	contactAddress?: string;
	originalAmount?: number;
	paidAmount?: number;
	remainingAmount?: number;
	dueDate?: string;
	description?: string;
	status?: 'active' | 'paid' | 'overdue';
	isActive?: boolean;
}

// ============================================================================
// Debt Operations
// ============================================================================

/**
 * Create a new debt
 */
export async function createDebt(input: CreateDebtInput): Promise<DebtRecord> {
	const record: DebtRecord = {
		id: generateId(),
		userId: input.userId,
		type: input.type,
		contactName: input.contactName,
		contactPhone: input.contactPhone ?? null,
		contactAddress: input.contactAddress ?? null,
		originalAmount: input.originalAmount,
		paidAmount: 0,
		remainingAmount: input.originalAmount,
		date: input.date,
		dueDate: input.dueDate ?? null,
		description: input.description ?? null,
		status: 'active',
		isActive: true,
		createdAt: now(),
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.debts.add(record);
	return record;
}

/**
 * Get debt by ID
 */
export async function getDebt(id: string): Promise<DebtRecord | undefined> {
	return db.debts.get(id);
}

/**
 * Get all debts for a user
 */
export async function getDebts(
	userId: string,
	options?: {
		type?: 'piutang' | 'hutang';
		status?: 'active' | 'paid' | 'overdue';
		isActive?: boolean;
		syncStatus?: SyncStatus;
	}
): Promise<DebtRecord[]> {
	const collection = db.debts.where('userId').equals(userId);
	let results = await collection.toArray();

	if (options?.type) {
		results = results.filter((d) => d.type === options.type);
	}
	if (options?.status) {
		results = results.filter((d) => d.status === options.status);
	}
	if (options?.isActive !== undefined) {
		results = results.filter((d) => d.isActive === options.isActive);
	}
	if (options?.syncStatus) {
		results = results.filter((d) => d.syncStatus === options.syncStatus);
	}

	// Sort by date descending
	results.sort((a, b) => b.date.localeCompare(a.date));
	return results;
}

/**
 * Update a debt
 */
export async function updateDebt(
	id: string,
	input: UpdateDebtInput
): Promise<DebtRecord | undefined> {
	const existing = await db.debts.get(id);
	if (!existing) return undefined;

	const updated: DebtRecord = {
		...existing,
		...input,
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.debts.put(updated);
	return updated;
}

/**
 * Record a payment on a debt
 */
export async function recordDebtPayment(
	id: string,
	amount: number
): Promise<DebtRecord | undefined> {
	const existing = await db.debts.get(id);
	if (!existing) return undefined;

	existing.paidAmount += amount;
	existing.remainingAmount = existing.originalAmount - existing.paidAmount;

	if (existing.remainingAmount <= 0) {
		existing.status = 'paid';
		existing.remainingAmount = 0;
	}

	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.debts.put(existing);
	return existing;
}

/**
 * Delete a debt (soft delete)
 */
export async function deleteDebt(id: string): Promise<boolean> {
	const existing = await db.debts.get(id);
	if (!existing) return false;

	existing.isActive = false;
	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.debts.put(existing);
	return true;
}

/**
 * Get pending debts for sync
 */
export async function getPendingDebts(userId: string): Promise<DebtRecord[]> {
	return db.debts
		.where('userId')
		.equals(userId)
		.and((d) => d.syncStatus === 'pending')
		.toArray();
}

/**
 * Mark debts as synced
 */
export async function markDebtsSynced(ids: string[]): Promise<void> {
	await db.transaction('rw', db.debts, async () => {
		for (const id of ids) {
			const debt = await db.debts.get(id);
			if (debt) {
				debt.syncStatus = 'synced';
				await db.debts.put(debt);
			}
		}
	});
}

/**
 * Get debt summary for a user
 */
export async function getDebtSummary(userId: string): Promise<{
	piutang: { active: number; paid: number; overdue: number };
	hutang: { active: number; paid: number; overdue: number };
}> {
	const debts = await getDebts(userId, { isActive: true });

	const summary = {
		piutang: { active: 0, paid: 0, overdue: 0 },
		hutang: { active: 0, paid: 0, overdue: 0 }
	};

	for (const debt of debts) {
		summary[debt.type][debt.status] += debt.remainingAmount;
	}

	return summary;
}

// ============================================================================
// Debt Payment CRUD
// ============================================================================

export interface CreateDebtPaymentInput {
	debtId: string;
	userId: string;
	amount: number;
	date: string;
	accountId: string;
	transactionId?: string;
	notes?: string;
}

/**
 * Create a new debt payment
 */
export async function createDebtPayment(input: CreateDebtPaymentInput): Promise<DebtPaymentRecord> {
	const record: DebtPaymentRecord = {
		id: generateId(),
		debtId: input.debtId,
		userId: input.userId,
		amount: input.amount,
		date: input.date,
		accountId: input.accountId,
		transactionId: input.transactionId ?? null,
		notes: input.notes ?? null,
		createdAt: now(),
		syncStatus: 'pending'
	};

	// Use transaction to ensure data integrity
	await db.transaction('rw', [db.debtPayments, db.debts], async () => {
		await db.debtPayments.add(record);
		// Update the debt within the same transaction
		await recordDebtPayment(input.debtId, input.amount);
	});

	return record;
}

/**
 * Get all payments for a debt
 */
export async function getDebtPayments(debtId: string): Promise<DebtPaymentRecord[]> {
	return db.debtPayments.where('debtId').equals(debtId).toArray();
}

/**
 * Get pending debt payments for sync
 */
export async function getPendingDebtPayments(userId: string): Promise<DebtPaymentRecord[]> {
	return db.debtPayments
		.where('userId')
		.equals(userId)
		.and((p) => p.syncStatus === 'pending')
		.toArray();
}

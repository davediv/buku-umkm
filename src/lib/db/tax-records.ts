import { db, generateId, now } from './index';
import type { TaxRecordRecord, SyncStatus } from './schema';

// ============================================================================
// Tax Record CRUD Operations
// ============================================================================

export interface CreateTaxRecordInput {
	userId: string;
	year: number;
	month?: number;
	taxType: string;
	taxableIncome: number;
	taxRate: number;
	taxAmount: number;
	notes?: string;
}

export interface UpdateTaxRecordInput {
	taxableIncome?: number;
	taxRate?: number;
	taxAmount?: number;
	status?: 'unpaid' | 'paid' | 'overdue';
	billingCode?: string;
	paymentDate?: string;
	notes?: string;
}

/**
 * Create a new tax record
 */
export async function createTaxRecord(input: CreateTaxRecordInput): Promise<TaxRecordRecord> {
	const record: TaxRecordRecord = {
		id: generateId(),
		userId: input.userId,
		year: input.year,
		month: input.month ?? null,
		taxType: input.taxType,
		taxableIncome: input.taxableIncome,
		taxRate: input.taxRate,
		taxAmount: input.taxAmount,
		status: 'unpaid',
		billingCode: null,
		paymentDate: null,
		notes: input.notes ?? null,
		createdAt: now(),
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.taxRecords.add(record);
	return record;
}

/**
 * Get tax record by ID
 */
export async function getTaxRecord(id: string): Promise<TaxRecordRecord | undefined> {
	return db.taxRecords.get(id);
}

/**
 * Get all tax records for a user
 */
export async function getTaxRecords(
	userId: string,
	options?: {
		year?: number;
		month?: number;
		taxType?: string;
		status?: 'unpaid' | 'paid' | 'overdue';
		syncStatus?: SyncStatus;
	}
): Promise<TaxRecordRecord[]> {
	const collection = db.taxRecords.where('userId').equals(userId);
	let results = await collection.toArray();

	if (options?.year) {
		results = results.filter((t) => t.year === options.year);
	}
	if (options?.month !== undefined) {
		results = results.filter((t) => t.month === options.month);
	}
	if (options?.taxType) {
		results = results.filter((t) => t.taxType === options.taxType);
	}
	if (options?.status) {
		results = results.filter((t) => t.status === options.status);
	}
	if (options?.syncStatus) {
		results = results.filter((t) => t.syncStatus === options.syncStatus);
	}

	// Sort by year and month
	results.sort((a, b) => {
		const yearDiff = b.year - a.year;
		if (yearDiff !== 0) return yearDiff;
		return (b.month ?? 0) - (a.month ?? 0);
	});

	return results;
}

/**
 * Get tax record for specific year/month
 */
export async function getTaxRecordByPeriod(
	userId: string,
	year: number,
	month?: number
): Promise<TaxRecordRecord | undefined> {
	const records = await getTaxRecords(userId, { year, month });
	return records[0];
}

/**
 * Update a tax record
 */
export async function updateTaxRecord(
	id: string,
	input: UpdateTaxRecordInput
): Promise<TaxRecordRecord | undefined> {
	const existing = await db.taxRecords.get(id);
	if (!existing) return undefined;

	const updated: TaxRecordRecord = {
		...existing,
		...input,
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.taxRecords.put(updated);
	return updated;
}

/**
 * Mark tax record as paid
 */
export async function markTaxPaid(
	id: string,
	billingCode: string,
	paymentDate: string
): Promise<TaxRecordRecord | undefined> {
	const existing = await db.taxRecords.get(id);
	if (!existing) return undefined;

	existing.status = 'paid';
	existing.billingCode = billingCode;
	existing.paymentDate = paymentDate;
	existing.updatedAt = now();
	existing.syncStatus = 'pending';

	await db.taxRecords.put(existing);
	return existing;
}

/**
 * Delete a tax record
 */
export async function deleteTaxRecord(id: string): Promise<boolean> {
	const existing = await db.taxRecords.get(id);
	if (!existing) return false;

	await db.taxRecords.delete(id);
	return true;
}

/**
 * Get pending tax records for sync
 */
export async function getPendingTaxRecords(userId: string): Promise<TaxRecordRecord[]> {
	return db.taxRecords
		.where('userId')
		.equals(userId)
		.and((t) => t.syncStatus === 'pending')
		.toArray();
}

/**
 * Mark tax records as synced
 */
export async function markTaxRecordsSynced(ids: string[]): Promise<void> {
	await db.transaction('rw', db.taxRecords, async () => {
		for (const id of ids) {
			const record = await db.taxRecords.get(id);
			if (record) {
				record.syncStatus = 'synced';
				await db.taxRecords.put(record);
			}
		}
	});
}

/**
 * Get tax summary for a user
 */
export async function getTaxSummary(
	userId: string,
	year: number
): Promise<{
	monthly: Array<{ month: number; amount: number; status: string }>;
	annual: { totalTaxable: number; totalTax: number; paid: number; unpaid: number };
}> {
	const records = await getTaxRecords(userId, { year });

	const monthly: Array<{ month: number; amount: number; status: string }> = [];
	let totalTaxable = 0;
	let totalTax = 0;
	let paid = 0;
	let unpaid = 0;

	for (const record of records) {
		if (record.month !== null) {
			monthly.push({
				month: record.month,
				amount: record.taxAmount,
				status: record.status
			});
		}
		totalTaxable += record.taxableIncome;
		totalTax += record.taxAmount;

		if (record.status === 'paid') {
			paid += record.taxAmount;
		} else {
			unpaid += record.taxAmount;
		}
	}

	return {
		monthly,
		annual: { totalTaxable, totalTax, paid, unpaid }
	};
}

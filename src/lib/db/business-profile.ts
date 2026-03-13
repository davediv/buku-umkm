import { db, generateId, now } from './index';
import type { BusinessProfileRecord, SyncStatus } from './schema';

// ============================================================================
// Business Profile CRUD Operations
// ============================================================================

export interface CreateBusinessProfileInput {
	userId: string;
	name: string;
	address?: string;
	phone?: string;
	npwp?: string;
	businessType: string;
	ownerName?: string;
	industry?: string;
}

export interface UpdateBusinessProfileInput {
	name?: string;
	address?: string;
	phone?: string;
	npwp?: string;
	businessType?: string;
	ownerName?: string;
	industry?: string;
}

/**
 * Create a new business profile
 */
export async function createBusinessProfile(
	input: CreateBusinessProfileInput
): Promise<BusinessProfileRecord> {
	const record: BusinessProfileRecord = {
		id: generateId(),
		userId: input.userId,
		name: input.name,
		address: input.address ?? null,
		phone: input.phone ?? null,
		npwp: input.npwp ?? null,
		businessType: input.businessType,
		ownerName: input.ownerName ?? null,
		industry: input.industry ?? null,
		createdAt: now(),
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.businessProfiles.add(record);
	return record;
}

/**
 * Get business profile by ID
 */
export async function getBusinessProfile(id: string): Promise<BusinessProfileRecord | undefined> {
	return db.businessProfiles.get(id);
}

/**
 * Get all business profiles for a user
 */
export async function getBusinessProfiles(
	userId: string,
	options?: {
		syncStatus?: SyncStatus;
	}
): Promise<BusinessProfileRecord[]> {
	const collection = db.businessProfiles.where('userId').equals(userId);
	let results = await collection.toArray();

	if (options?.syncStatus) {
		results = results.filter((b) => b.syncStatus === options.syncStatus);
	}

	// Sort by name
	results.sort((a, b) => a.name.localeCompare(b.name));
	return results;
}

/**
 * Get primary business profile for a user (first one)
 */
export async function getPrimaryBusinessProfile(
	userId: string
): Promise<BusinessProfileRecord | undefined> {
	const profiles = await getBusinessProfiles(userId);
	return profiles[0];
}

/**
 * Update a business profile
 */
export async function updateBusinessProfile(
	id: string,
	input: UpdateBusinessProfileInput
): Promise<BusinessProfileRecord | undefined> {
	const existing = await db.businessProfiles.get(id);
	if (!existing) return undefined;

	const updated: BusinessProfileRecord = {
		...existing,
		...input,
		updatedAt: now(),
		syncStatus: 'pending'
	};

	await db.businessProfiles.put(updated);
	return updated;
}

/**
 * Delete a business profile
 */
export async function deleteBusinessProfile(id: string): Promise<boolean> {
	const existing = await db.businessProfiles.get(id);
	if (!existing) return false;

	await db.businessProfiles.delete(id);
	return true;
}

/**
 * Get pending business profiles for sync
 */
export async function getPendingBusinessProfiles(userId: string): Promise<BusinessProfileRecord[]> {
	return db.businessProfiles
		.where('userId')
		.equals(userId)
		.and((b) => b.syncStatus === 'pending')
		.toArray();
}

/**
 * Mark business profiles as synced
 */
export async function markBusinessProfilesSynced(ids: string[]): Promise<void> {
	await db.transaction('rw', db.businessProfiles, async () => {
		for (const id of ids) {
			const profile = await db.businessProfiles.get(id);
			if (profile) {
				profile.syncStatus = 'synced';
				await db.businessProfiles.put(profile);
			}
		}
	});
}

// Storage usage monitoring utilities
// Uses the Storage Manager API to track IndexedDB usage

import { browser } from '$app/environment';

export interface StorageInfo {
	usage: number;
	quota: number;
	percentage: number;
	isNearLimit: boolean;
	isOverLimit: boolean;
}

// Default quota estimate if API not available (50MB)
const DEFAULT_QUOTA = 50 * 1024 * 1024;

/**
 * Get current storage usage information
 */
export async function getStorageInfo(): Promise<StorageInfo> {
	if (!browser) {
		return {
			usage: 0,
			quota: DEFAULT_QUOTA,
			percentage: 0,
			isNearLimit: false,
			isOverLimit: false
		};
	}

	try {
		// Check if StorageManager API is available
		if (navigator.storage && navigator.storage.estimate) {
			const estimate = await navigator.storage.estimate();

			const usage = estimate.usage ?? 0;
			const quota = estimate.quota ?? DEFAULT_QUOTA;
			const percentage = quota > 0 ? (usage / quota) * 100 : 0;

			// Near limit is when usage exceeds 80% of quota
			// Over limit is when usage exceeds 100% (though this is rare)
			return {
				usage,
				quota,
				percentage,
				isNearLimit: percentage >= 80,
				isOverLimit: percentage >= 100
			};
		}

		// Fallback: estimate based on rough record counts
		// This is a simplified estimate
		const estimatedUsage = await estimateIndexedDBUsage();

		return {
			usage: estimatedUsage,
			quota: DEFAULT_QUOTA,
			percentage: (estimatedUsage / DEFAULT_QUOTA) * 100,
			isNearLimit: estimatedUsage >= DEFAULT_QUOTA * 0.8,
			isOverLimit: estimatedUsage >= DEFAULT_QUOTA
		};
	} catch (error) {
		console.error('Error getting storage info:', error);
		return {
			usage: 0,
			quota: DEFAULT_QUOTA,
			percentage: 0,
			isNearLimit: false,
			isOverLimit: false
		};
	}
}

/**
 * Estimate IndexedDB usage by counting records
 * This is a rough estimate since we can't get exact sizes
 */
async function estimateIndexedDBUsage(): Promise<number> {
	// Rough estimates per record type
	const estimates = {
		accounts: 500, // bytes per account
		categories: 300, // bytes per category
		transactions: 600, // bytes per transaction
		debts: 700, // bytes per debt
		debtPayments: 400, // bytes per payment
		taxRecords: 500, // bytes per tax record
		businessProfiles: 800 // bytes per profile
	};

	// Dynamic import to avoid SSR issues
	const { db } = await import('./index');

	try {
		const [accounts, categories, transactions, debts, debtPayments, taxRecords, businessProfiles] =
			await Promise.all([
				db.accounts.count(),
				db.categories.count(),
				db.transactions.count(),
				db.debts.count(),
				db.debtPayments.count(),
				db.taxRecords.count(),
				db.businessProfiles.count()
			]);

		const total =
			accounts * estimates.accounts +
			categories * estimates.categories +
			transactions * estimates.transactions +
			debts * estimates.debts +
			debtPayments * estimates.debtPayments +
			taxRecords * estimates.taxRecords +
			businessProfiles * estimates.businessProfiles;

		return total;
	} catch {
		return 0;
	}
}

/**
 * Request persistent storage
 * Returns true if storage was granted
 */
export async function requestPersistentStorage(): Promise<boolean> {
	if (!browser) return false;

	try {
		if (navigator.storage && navigator.storage.persist) {
			const isPersisted = await navigator.storage.persist();
			return isPersisted;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Check if storage is persisted
 */
export async function isStoragePersisted(): Promise<boolean> {
	if (!browser) return false;

	try {
		if (navigator.storage && navigator.storage.persisted) {
			return await navigator.storage.persisted();
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get storage status message
 */
export function getStorageStatusMessage(info: StorageInfo): string | null {
	if (info.isOverLimit) {
		return `Penyimpanan penuh (${info.percentage.toFixed(1)}%). Harap hapus beberapa data.`;
	}
	if (info.isNearLimit) {
		return `Penyimpanan hampir penuh (${info.percentage.toFixed(1)}%). Pertimbangkan untuk membersihkan data lama.`;
	}
	return null;
}

// ============================================================================
// Storage Warning System
// ============================================================================

let storageCheckInterval: ReturnType<typeof setInterval> | null = null;
const warningCallbacks: Set<(message: string) => void> = new Set();

/**
 * Subscribe to storage warnings
 */
export function onStorageWarning(callback: (message: string) => void): () => void {
	warningCallbacks.add(callback);
	return () => warningCallbacks.delete(callback);
}

/**
 * Start periodic storage checks
 * @param intervalMs Check interval in milliseconds (default: 5 minutes)
 */
export function startStorageMonitoring(intervalMs: number = 5 * 60 * 1000): void {
	if (!browser || storageCheckInterval) return;

	const check = async () => {
		const info = await getStorageInfo();
		const message = getStorageStatusMessage(info);

		if (message) {
			warningCallbacks.forEach((callback) => callback(message));
		}
	};

	// Initial check
	check();

	// Periodic checks
	storageCheckInterval = setInterval(check, intervalMs);
}

/**
 * Stop periodic storage checks
 */
export function stopStorageMonitoring(): void {
	if (storageCheckInterval) {
		clearInterval(storageCheckInterval);
		storageCheckInterval = null;
	}
}

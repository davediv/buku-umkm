// Sync utilities for offline-to-online synchronization

import { browser } from '$app/environment';
import { db, getPendingRecords } from './index';
import type { SyncStatus } from './schema';

// ============================================================================
// Sync Configuration
// ============================================================================

const SYNC_CONFIG = {
	// Maximum retry attempts for failed syncs
	maxRetries: 5,
	// Base delay in milliseconds for exponential backoff
	baseDelay: 1000,
	// Maximum delay in milliseconds
	maxDelay: 30000,
	// Batch size for syncing records
	batchSize: 50,
	// Auto-sync interval in milliseconds (5 minutes)
	autoSyncInterval: 5 * 60 * 1000,
	// Minimum time between auto-syncs
	minAutoSyncInterval: 60000
};

// ============================================================================
// Sync State
// ============================================================================

export interface SyncState {
	isOnline: boolean;
	isSyncing: boolean;
	lastSyncTime: Date | null;
	pendingCount: number;
	error: string | null;
}

// Retry state
interface RetryState {
	attempts: number;
	nextRetryTime: number;
	lastError: string | null;
}

// Current sync state
let syncState: SyncState = {
	isOnline: true,
	isSyncing: false,
	lastSyncTime: null,
	pendingCount: 0,
	error: null
};

// Retry state for exponential backoff
let retryState: RetryState = {
	attempts: 0,
	nextRetryTime: 0,
	lastError: null
};

// Current user ID for sync
let currentUserId: string | null = null;

// Auto-sync timer
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

// Callbacks for state changes
const listeners: Set<(state: SyncState) => void> = new Set();

// Conflict notifications
const conflictListeners: Set<(conflicts: SyncConflict[]) => void> = new Set();

export interface SyncConflict {
	table: string;
	localId: string;
	localUpdatedAt: Date;
	serverUpdatedAt: Date;
	resolution: 'local_wins' | 'server_wins';
}

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
	return { ...syncState };
}

/**
 * Subscribe to sync state changes
 */
export function onSyncStateChange(callback: (state: SyncState) => void): () => void {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

/**
 * Subscribe to sync conflicts
 */
export function onSyncConflicts(callback: (conflicts: SyncConflict[]) => void): () => void {
	conflictListeners.add(callback);
	return () => conflictListeners.delete(callback);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(): void {
	const state = getSyncState();
	listeners.forEach((callback) => callback(state));
}

/**
 * Notify conflict listeners
 */
function notifyConflicts(conflicts: SyncConflict[]): void {
	if (conflicts.length > 0) {
		conflictListeners.forEach((callback) => callback(conflicts));
	}
}

/**
 * Set current user ID for sync operations
 */
export function setSyncUserId(userId: string): void {
	currentUserId = userId;
}

/**
 * Get current user ID
 */
export function getSyncUserId(): string | null {
	return currentUserId;
}

/**
 * Initialize sync state listeners (call from app root)
 */
export function initSyncListeners(): void {
	if (!browser) return;

	// Listen for online/offline events
	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	// Initial state
	syncState.isOnline = navigator.onLine;
	notifyListeners();
}

/**
 * Cleanup sync state listeners
 */
export function cleanupSyncListeners(): void {
	if (!browser) return;

	window.removeEventListener('online', handleOnline);
	window.removeEventListener('offline', handleOffline);

	// Clear auto-sync timer
	if (autoSyncTimer) {
		clearInterval(autoSyncTimer);
		autoSyncTimer = null;
	}
}

/**
 * Start auto-sync timer
 */
export function startAutoSync(userId: string): void {
	if (!browser) return;

	setSyncUserId(userId);

	// Clear existing timer
	if (autoSyncTimer) {
		clearInterval(autoSyncTimer);
	}

	// Start new timer
	autoSyncTimer = setInterval(() => {
		if (syncState.isOnline && !syncState.isSyncing && currentUserId) {
			triggerSync(currentUserId, { auto: true });
		}
	}, SYNC_CONFIG.autoSyncInterval);
}

/**
 * Stop auto-sync timer
 */
export function stopAutoSync(): void {
	if (autoSyncTimer) {
		clearInterval(autoSyncTimer);
		autoSyncTimer = null;
	}
	currentUserId = null;
}

/**
 * Handle coming online
 */
function handleOnline(): void {
	syncState.isOnline = true;
	syncState.error = null;
	notifyListeners();

	// Reset retry state on reconnect
	retryState = {
		attempts: 0,
		nextRetryTime: 0,
		lastError: null
	};

	// Trigger sync if we have a user ID
	if (currentUserId) {
		triggerSync(currentUserId, { auto: true });
	}
}

/**
 * Handle going offline
 */
function handleOffline(): void {
	syncState.isOnline = false;
	notifyListeners();
}

/**
 * Update sync state
 */
function updateSyncState(updates: Partial<SyncState>): void {
	syncState = { ...syncState, ...updates };
	notifyListeners();
}

/**
 * Calculate delay with exponential backoff
 */
function getBackoffDelay(attempt: number): number {
	const delay = SYNC_CONFIG.baseDelay * Math.pow(2, attempt);
	return Math.min(delay, SYNC_CONFIG.maxDelay);
}

/**
 * Check if we should retry
 */
function shouldRetry(): boolean {
	if (retryState.attempts >= SYNC_CONFIG.maxRetries) {
		return false;
	}

	const now = Date.now();
	if (now < retryState.nextRetryTime) {
		return false;
	}

	return true;
}

/**
 * Schedule a retry with exponential backoff
 */
function scheduleRetry(error: string): void {
	retryState.attempts++;
	retryState.lastError = error;
	retryState.nextRetryTime = Date.now() + getBackoffDelay(retryState.attempts);

	console.log(
		`Sync retry scheduled: attempt ${retryState.attempts}/${SYNC_CONFIG.maxRetries}, ` +
			`delay ${getBackoffDelay(retryState.attempts)}ms`
	);
}

/**
 * Reset retry state
 */
function resetRetryState(): void {
	retryState = {
		attempts: 0,
		nextRetryTime: 0,
		lastError: null
	};
}

/**
 * Serialize record for API (convert Dates to ISO strings)
 */
function serializeRecord<T extends Record<string, unknown>>(record: T): T {
	const serialized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(record)) {
		if (value instanceof Date) {
			serialized[key] = value.toISOString();
		} else if (value !== undefined) {
			serialized[key] = value;
		}
	}

	return serialized as T;
}

/**
 * Sync a single table to the server
 */
async function syncTable(
	tableName: string,
	records: Record<string, unknown>[]
): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
	const success: string[] = [];
	const failed: { id: string; error: string }[] = [];

	if (records.length === 0) {
		return { success, failed };
	}

	try {
		const response = await fetch('/api/sync', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				[tableName]: records.map(serializeRecord)
			})
		});

		if (!response.ok) {
			throw new Error(`Server error: ${response.status}`);
		}

		const result = (await response.json()) as {
			results?: Record<string, { id: string; success: boolean; error?: string }[]>;
		};
		const tableResults = result.results?.[tableName] || [];

		for (const item of tableResults) {
			if (item.success) {
				success.push(item.id);
			} else {
				failed.push({ id: item.id, error: item.error || 'Unknown error' });
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Network error';
		// Mark all records in this batch as failed
		for (const record of records) {
			failed.push({ id: record.id as string, error: errorMessage });
		}
	}

	return { success, failed };
}

/**
 * Mark records as synced in IndexedDB
 */
async function markRecordsSynced(
	tableName: string,
	ids: string[],
	status: SyncStatus = 'synced'
): Promise<void> {
	// Get the appropriate table based on table name
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let table: any;

	switch (tableName) {
		case 'transactions':
			table = db.transactions;
			break;
		case 'accounts':
			table = db.accounts;
			break;
		case 'categories':
			table = db.categories;
			break;
		case 'debts':
			table = db.debts;
			break;
		case 'businessProfiles':
			table = db.businessProfiles;
			break;
		case 'taxRecords':
			table = db.taxRecords;
			break;
		default:
			console.error(`Unknown table: ${tableName}`);
			return;
	}

	if (!table || typeof table.get !== 'function') {
		console.error(`Invalid table: ${tableName}`);
		return;
	}

	for (const id of ids) {
		const record = await table.get(id);
		if (record) {
			record.syncStatus = status;
			record.updatedAt = new Date();
			await table.put(record);
		}
	}
}

/**
 * Manually trigger sync
 */
export async function triggerSync(userId: string, options?: { auto?: boolean }): Promise<boolean> {
	if (!browser) return false;

	// Don't sync if offline
	if (!navigator.onLine) {
		updateSyncState({ error: 'Tidak ada koneksi internet' });
		return false;
	}

	// Don't sync if already syncing (unless forced)
	if (syncState.isSyncing) {
		return false;
	}

	// Check if we should retry
	if (!options?.auto && !shouldRetry()) {
		const waitTime = retryState.nextRetryTime - Date.now();
		updateSyncState({
			error: `Menunggu retry dalam ${Math.ceil(waitTime / 1000)} detik...`
		});
		return false;
	}

	updateSyncState({ isSyncing: true, error: null });
	setSyncUserId(userId);

	const startTime = Date.now();
	const conflicts: SyncConflict[] = [];

	try {
		// Get pending records
		const pending = await getPendingRecords(userId);

		const totalPending =
			pending.accounts.length +
			pending.categories.length +
			pending.transactions.length +
			pending.debts.length +
			pending.businessProfiles.length;

		if (totalPending === 0) {
			updateSyncState({
				isSyncing: false,
				lastSyncTime: new Date(),
				pendingCount: 0
			});
			resetRetryState();
			return true;
		}

		console.log(`Starting sync, pending: ${totalPending}`);

		// Sync each table in batches
		const results = await Promise.all([
			syncTable('transactions', pending.transactions as unknown as Record<string, unknown>[]),
			syncTable('accounts', pending.accounts as unknown as Record<string, unknown>[]),
			syncTable('categories', pending.categories as unknown as Record<string, unknown>[]),
			syncTable('debts', pending.debts as unknown as Record<string, unknown>[]),
			syncTable(
				'businessProfiles',
				pending.businessProfiles as unknown as Record<string, unknown>[]
			)
		]);

		// Mark successful syncs
		await Promise.all([
			markRecordsSynced('transactions', results[0].success),
			markRecordsSynced('accounts', results[1].success),
			markRecordsSynced('categories', results[2].success),
			markRecordsSynced('debts', results[3].success),
			markRecordsSynced('businessProfiles', results[4].success)
		]);

		// Mark failed syncs
		await Promise.all([
			markRecordsSynced(
				'transactions',
				results[0].failed.map((f) => f.id),
				'error'
			),
			markRecordsSynced(
				'accounts',
				results[1].failed.map((f) => f.id),
				'error'
			),
			markRecordsSynced(
				'categories',
				results[2].failed.map((f) => f.id),
				'error'
			),
			markRecordsSynced(
				'debts',
				results[3].failed.map((f) => f.id),
				'error'
			),
			markRecordsSynced(
				'businessProfiles',
				results[4].failed.map((f) => f.id),
				'error'
			)
		]);

		// Calculate remaining pending
		const totalFailed =
			results[0].failed.length +
			results[1].failed.length +
			results[2].failed.length +
			results[3].failed.length +
			results[4].failed.length;

		const elapsed = Date.now() - startTime;
		console.log(
			`Sync completed in ${elapsed}ms: ${totalPending - totalFailed} success, ${totalFailed} failed`
		);

		if (totalFailed > 0) {
			// Schedule retry with exponential backoff
			const firstError = results.flatMap((r) => r.failed).find((f) => f.error);
			scheduleRetry(firstError?.error || 'Unknown error');

			updateSyncState({
				isSyncing: false,
				lastSyncTime: new Date(),
				pendingCount: totalFailed,
				error: `${totalFailed} data gagal sinkronisasi. Akan retry otomatis.`
			});
		} else {
			resetRetryState();
			updateSyncState({
				isSyncing: false,
				lastSyncTime: new Date(),
				pendingCount: 0,
				error: null
			});
		}

		// Notify about any conflicts (for future UI implementation)
		if (conflicts.length > 0) {
			notifyConflicts(conflicts);
		}

		return totalFailed === 0;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Sync failed';
		console.error('Sync error:', errorMessage);

		// Schedule retry
		scheduleRetry(errorMessage);

		updateSyncState({
			isSyncing: false,
			lastSyncTime: syncState.lastSyncTime,
			error: `Gagal sinkronisasi: ${errorMessage}`
		});

		return false;
	}
}

/**
 * Get pending count for a user
 */
export async function getPendingCount(userId: string): Promise<number> {
	const pending = await getPendingRecords(userId);
	return (
		pending.accounts.length +
		pending.categories.length +
		pending.transactions.length +
		pending.debts.length +
		pending.taxRecords.length +
		pending.businessProfiles.length
	);
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
	if (!browser) return true;
	return navigator.onLine;
}

/**
 * Force refresh pending count
 */
export async function refreshPendingCount(userId: string): Promise<void> {
	if (!browser) return;

	const count = await getPendingCount(userId);
	updateSyncState({ pendingCount: count });
}

// Sync utilities for offline-to-online synchronization

import { browser } from '$app/environment';
import { getPendingRecords } from './index';

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

// Current sync state
let syncState: SyncState = {
	isOnline: true,
	isSyncing: false,
	lastSyncTime: null,
	pendingCount: 0,
	error: null
};

// Callbacks for state changes
const listeners: Set<(state: SyncState) => void> = new Set();

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
 * Notify all listeners of state change
 */
function notifyListeners(): void {
	const state = getSyncState();
	listeners.forEach((callback) => callback(state));
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
}

/**
 * Handle coming online
 */
function handleOnline(): void {
	syncState.isOnline = true;
	syncState.error = null;
	notifyListeners();

	// Sync will be triggered manually when user is authenticated
	// Call triggerSync(userId) with valid userId after login
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
 * Manually trigger sync
 */
export async function triggerSync(userId: string): Promise<boolean> {
	if (!browser) return false;

	if (!navigator.onLine) {
		updateSyncState({ error: 'Tidak ada koneksi internet' });
		return false;
	}

	if (syncState.isSyncing) {
		return false;
	}

	updateSyncState({ isSyncing: true, error: null });

	try {
		// Get pending records
		const pending = await getPendingRecords(userId);

		const totalPending =
			pending.accounts.length +
			pending.categories.length +
			pending.transactions.length +
			pending.debts.length +
			pending.taxRecords.length +
			pending.businessProfiles.length;

		if (totalPending === 0) {
			updateSyncState({
				isSyncing: false,
				lastSyncTime: new Date(),
				pendingCount: 0
			});
			return true;
		}

		// TODO: Implement actual API sync
		// For now, this is a placeholder that would call the API endpoints
		// to sync pending records to the server

		// Example sync implementation:
		// for (const account of pending.accounts) {
		//   await fetch('/api/accounts', {
		//     method: 'POST',
		//     body: JSON.stringify(account)
		//   });
		// }

		// After successful sync, mark records as synced
		// await markAccountsSynced(pending.accounts.map(a => a.id));
		// etc.

		// For now, simulate successful sync
		console.log('Sync triggered for user:', userId, 'Pending records:', totalPending);

		updateSyncState({
			isSyncing: false,
			lastSyncTime: new Date(),
			pendingCount: 0
		});

		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Sync failed';
		updateSyncState({
			isSyncing: false,
			error: errorMessage
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

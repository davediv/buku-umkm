// Svelte stores for reactive IndexedDB state
// Provides reactive access to sync state and storage info

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { onSyncStateChange, initSyncListeners, cleanupSyncListeners } from './sync';
import type { SyncState } from './sync';
import {
	getStorageInfo,
	getStorageStatusMessage,
	onStorageWarning,
	startStorageMonitoring,
	stopStorageMonitoring
} from './usage';
import type { StorageInfo } from './usage';

// ============================================================================
// Sync State Store
// ============================================================================

function createSyncStore() {
	const { subscribe, set, update } = writable<SyncState>({
		isOnline: browser ? navigator.onLine : true,
		isSyncing: false,
		lastSyncTime: null,
		pendingCount: 0,
		error: null
	});

	let unsubscribe: (() => void) | null = null;

	return {
		subscribe,
		init() {
			if (!browser) return;

			// Subscribe to sync state changes
			unsubscribe = onSyncStateChange((state: SyncState) => {
				set(state);
			});

			// Initialize listeners
			initSyncListeners();
		},
		destroy() {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}

			if (browser) {
				cleanupSyncListeners();
			}
		},
		update
	};
}

export const syncStore = createSyncStore();

// ============================================================================
// Storage Info Store
// ============================================================================

function createStorageStore() {
	const { subscribe, set } = writable<StorageInfo>({
		usage: 0,
		quota: 0,
		percentage: 0,
		isNearLimit: false,
		isOverLimit: false
	});

	let unsubscribe: (() => void) | null = null;

	return {
		subscribe,
		async refresh() {
			if (!browser) return;
			const info = await getStorageInfo();
			set(info);
		},
		init() {
			if (!browser) return;

			// Initial load
			this.refresh();

			// Subscribe to warnings
			unsubscribe = onStorageWarning((message: string) => {
				console.warn('Storage warning:', message);
			});

			// Start monitoring
			startStorageMonitoring(5 * 60 * 1000); // Check every 5 minutes
		},
		destroy() {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}

			if (browser) {
				stopStorageMonitoring();
			}
		}
	};
}

export const storageStore = createStorageStore();

// ============================================================================
// Derived Stores
// ============================================================================

// Whether the app can work offline (true when we're offline)
export const canWorkOffline: Readable<boolean> = derived(syncStore, ($sync) => {
	// Can work offline when: offline OR (online with synced data)
	return !$sync.isOnline || $sync.pendingCount === 0;
});

// Whether there are pending changes to sync
export const hasPendingChanges: Readable<boolean> = derived(
	syncStore,
	($sync) => $sync.pendingCount > 0
);

// Storage warning message
export const storageWarning: Readable<string | null> = derived(storageStore, ($storage) => {
	return getStorageStatusMessage($storage);
});

// ============================================================================
// Helper to initialize stores
// ============================================================================

/**
 * Initialize all stores - call from app root layout
 */
export function initStores(): void {
	syncStore.init();
	storageStore.init();
}

/**
 * Destroy all stores - call when app unmounts
 */
export function destroyStores(): void {
	syncStore.destroy();
	storageStore.destroy();
}

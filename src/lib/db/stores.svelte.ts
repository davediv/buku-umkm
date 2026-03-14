// Svelte 5 rune-based stores for reactive IndexedDB state
// Provides reactive access to sync state and storage info

import { browser } from '$app/environment';
import { onSyncStateChange, initSyncListeners, cleanupSyncListeners } from './sync';
import type { SyncState } from './sync';
import {
	getStorageInfo,
	onStorageWarning,
	startStorageMonitoring,
	stopStorageMonitoring
} from './usage';
import type { StorageInfo } from './usage';

// ============================================================================
// Sync State Store
// ============================================================================

let syncState = $state<SyncState>({
	isOnline: browser ? navigator.onLine : true,
	isSyncing: false,
	lastSyncTime: null,
	pendingCount: 0,
	error: null
});

let syncUnsubscribe: (() => void) | null = null;

export const syncStore = {
	get state() {
		return syncState;
	},
	init() {
		if (!browser) return;

		// Subscribe to sync state changes
		syncUnsubscribe = onSyncStateChange((state: SyncState) => {
			syncState = state;
		});

		// Initialize listeners
		initSyncListeners();
	},
	destroy() {
		if (syncUnsubscribe) {
			syncUnsubscribe();
			syncUnsubscribe = null;
		}

		if (browser) {
			cleanupSyncListeners();
		}
	}
};

// ============================================================================
// Storage Info Store
// ============================================================================

let storageState = $state<StorageInfo>({
	usage: 0,
	quota: 0,
	percentage: 0,
	isNearLimit: false,
	isOverLimit: false
});

let storageUnsubscribe: (() => void) | null = null;

export const storageStore = {
	get state() {
		return storageState;
	},
	async refresh() {
		if (!browser) return;
		const info = await getStorageInfo();
		storageState = info;
	},
	init() {
		if (!browser) return;

		// Initial load
		this.refresh();

		// Subscribe to warnings
		storageUnsubscribe = onStorageWarning((message: string) => {
			console.warn('Storage warning:', message);
		});

		// Start monitoring
		startStorageMonitoring(5 * 60 * 1000); // Check every 5 minutes
	},
	destroy() {
		if (storageUnsubscribe) {
			storageUnsubscribe();
			storageUnsubscribe = null;
		}

		if (browser) {
			stopStorageMonitoring();
		}
	}
};

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

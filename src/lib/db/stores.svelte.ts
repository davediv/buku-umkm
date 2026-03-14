// Svelte 5 rune-based stores for reactive IndexedDB state
// Provides reactive access to sync state

import { browser } from '$app/environment';
import { onSyncStateChange, initSyncListeners, cleanupSyncListeners } from './sync';
import type { SyncState } from './sync';

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
// Helper to initialize/destroy stores
// ============================================================================

/**
 * Initialize all stores - call from app root layout
 */
export function initStores(): void {
	syncStore.init();
}

/**
 * Destroy all stores - call when app unmounts
 */
export function destroyStores(): void {
	syncStore.destroy();
}

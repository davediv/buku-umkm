// Svelte 5 rune-based stores for reactive IndexedDB state
// Provides reactive access to sync state

import { browser } from '$app/environment';
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
let syncRuntimePromise: Promise<typeof import('./sync')> | null = null;
let lifecycleToken = 0;

function loadSyncRuntime() {
	return (syncRuntimePromise ??= import('./sync'));
}

export const syncStore = {
	get state() {
		return syncState;
	},
	init() {
		if (!browser) return;
		const token = ++lifecycleToken;

		void loadSyncRuntime().then((runtime) => {
			if (token !== lifecycleToken) return;

			syncUnsubscribe = runtime.onSyncStateChange((state: SyncState) => {
				syncState = state;
			});
			runtime.initSyncListeners();
		});
	},
	destroy() {
		lifecycleToken++;
		if (syncUnsubscribe) {
			syncUnsubscribe();
			syncUnsubscribe = null;
		}

		if (browser && syncRuntimePromise) {
			void syncRuntimePromise.then((runtime) => runtime.cleanupSyncListeners());
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

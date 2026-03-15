<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckCircle, Clock, AlertCircle, RefreshCw, WifiOff, X } from '@lucide/svelte';
	import { syncStore } from '$lib/db/stores.svelte';
	import { triggerSync, refreshPendingCount } from '$lib/db/sync';
	import { browser } from '$app/environment';

	// Type for sync status
	type SyncStatusType = 'offline' | 'error' | 'syncing' | 'pending' | 'synced';

	// Constants
	const SYNC_REFRESH_INTERVAL = 30000; // 30 seconds

	// State
	let showPopover = $state(false);
	let currentUserId: string | null = $state(null);

	// Get user ID from sessionStorage
	function getUserId(): string | null {
		if (!browser) return null;
		return sessionStorage.getItem('buku-umkm-user-id');
	}

	// Reactive sync state
	let syncState = $derived(syncStore.state);

	// Determine status type
	let statusType: SyncStatusType = $derived.by(() => {
		if (!syncState.isOnline) return 'offline';
		if (syncState.error) return 'error';
		if (syncState.isSyncing) return 'syncing';
		if (syncState.pendingCount > 0) return 'pending';
		return 'synced';
	});

	// Format last sync time (only compute when needed)
	let lastSyncText = $derived.by(() => {
		if (!syncState.lastSyncTime) return 'Belum pernah sinkron';
		const date = new Date(syncState.lastSyncTime);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return 'Baru saja';
		if (diffMins < 60) return `${diffMins} menit lalu`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} jam lalu`;
		const diffDays = Math.floor(diffHours / 24);
		return `${diffDays} hari lalu`;
	});

	// Handle manual sync
	async function handleManualSync() {
		if (!currentUserId) {
			console.warn('Cannot sync: user not logged in');
			return;
		}

		try {
			await triggerSync(currentUserId);
		} catch (error) {
			console.error('Sync failed:', error);
		} finally {
			showPopover = false;
		}
	}

	// Close popover when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (!showPopover) return;
		const target = event.target as HTMLElement;
		if (!target.closest('.sync-popover-container')) {
			showPopover = false;
		}
	}

	// Initialize on mount - refresh pending count periodically
	onMount(() => {
		if (!browser) return;

		// Cache user ID
		currentUserId = getUserId();
		if (!currentUserId) return;

		// Initial refresh with error handling
		refreshPendingCount(currentUserId).catch((error) => {
			console.error('Failed to refresh pending count:', error);
		});

		// Periodic refresh with error handling
		const interval = setInterval(() => {
			const uid = getUserId();
			if (uid) {
				refreshPendingCount(uid).catch((error) => {
					console.error('Failed to refresh pending count:', error);
				});
			}
		}, SYNC_REFRESH_INTERVAL);

		return () => clearInterval(interval);
	});

	// Toggle popover
	function togglePopover() {
		if (statusType !== 'offline') {
			showPopover = !showPopover;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<!-- Offline Mode Banner -->
{#if !syncState.isOnline}
	<div class="bg-gray-800 text-white px-4 py-2 flex items-center justify-center gap-2">
		<WifiOff class="w-4 h-4" />
		<span class="text-sm font-medium">Mode Offline</span>
	</div>
{/if}

<!-- Sync Status Indicator -->
{#if syncState.isOnline}
	<div class="sync-popover-container relative flex justify-center">
		<!-- Status Button (icon only, tooltip via aria-label) -->
		<button
			type="button"
			onclick={togglePopover}
			class="flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-secondary/50 cursor-pointer"
			aria-label="Status sinkronisasi"
			title={statusType === 'synced'
				? 'Tersinkron'
				: statusType === 'pending'
					? `${syncState.pendingCount} menunggu`
					: statusType === 'syncing'
						? 'Menyinkronkan...'
						: 'Sinkronisasi Gagal'}
		>
			{#if statusType === 'synced'}
				<CheckCircle class="w-5 h-5 text-green-600" />
			{:else if statusType === 'pending'}
				<Clock class="w-5 h-5 text-yellow-600" />
			{:else if statusType === 'syncing'}
				<RefreshCw class="w-5 h-5 text-blue-600 animate-spin" />
			{:else if statusType === 'error'}
				<AlertCircle class="w-5 h-5 text-red-600" />
			{/if}
		</button>

		<!-- Popover Detail -->
		{#if showPopover}
			<div
				class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-card border border-border rounded-lg shadow-lg z-[60] overflow-hidden md:bottom-0 md:left-full md:translate-x-0 md:ml-2 md:mb-0"
			>
				<!-- Header -->
				<div
					class="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30"
				>
					<h3 class="font-semibold text-sm">Status Sinkronisasi</h3>
					<button
						type="button"
						onclick={() => (showPopover = false)}
						class="p-1 rounded hover:bg-secondary transition-colors cursor-pointer"
						aria-label="Tutup"
					>
						<X class="w-4 h-4" />
					</button>
				</div>

				<!-- Content -->
				<div class="px-4 py-3 space-y-3">
					<!-- Status Row -->
					<div class="flex items-center gap-3">
						{#if statusType === 'synced'}
							<CheckCircle class="w-6 h-6 text-green-600" />
							<div>
								<p class="font-medium text-green-700">Tersinkron</p>
								<p class="text-xs text-muted-foreground">Semua data sudah diperbarui</p>
							</div>
						{:else if statusType === 'pending'}
							<Clock class="w-6 h-6 text-yellow-600" />
							<div>
								<p class="font-medium text-yellow-700">
									{syncState.pendingCount} transaksi menunggu
								</p>
								<p class="text-xs text-muted-foreground">Belum dikirim ke server</p>
							</div>
						{:else if statusType === 'syncing'}
							<RefreshCw class="w-6 h-6 text-blue-600 animate-spin" />
							<div>
								<p class="font-medium text-blue-700">Menyinkronkan...</p>
								<p class="text-xs text-muted-foreground">Mohon tunggu</p>
							</div>
						{:else if statusType === 'error'}
							<AlertCircle class="w-6 h-6 text-red-600" />
							<div>
								<p class="font-medium text-red-700">Sinkronisasi Gagal</p>
								<p class="text-xs text-muted-foreground">{syncState.error || 'Coba lagi nanti'}</p>
							</div>
						{/if}
					</div>

					<!-- Last Sync Time -->
					<div class="text-xs text-muted-foreground pt-2 border-t border-border">
						<p>Sinkronisasi terakhir: {lastSyncText}</p>
					</div>

					<!-- Manual Sync Button -->
					{#if currentUserId && !syncState.isSyncing}
						<button
							type="button"
							onclick={handleManualSync}
							disabled={syncState.isSyncing}
							class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
						>
							<RefreshCw class="w-4 h-4 {syncState.isSyncing ? 'animate-spin' : ''}" />
							<span>{syncState.isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
						</button>
					{:else if !currentUserId}
						<p class="text-xs text-muted-foreground text-center">
							Login untuk mengaktifkan sinkronisasi
						</p>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

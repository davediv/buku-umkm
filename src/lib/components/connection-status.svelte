<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Cloud, RefreshCw, TriangleAlert, WifiOff } from '@lucide/svelte';

	let { loadedAt }: { loadedAt: string } = $props();

	type ConnectionState = 'online' | 'offline' | 'refreshing' | 'stale';
	let state = $state<ConnectionState>('online');

	const loadedTime = $derived(
		new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
			new Date(loadedAt)
		)
	);

	async function refreshData() {
		if (!navigator.onLine) {
			state = 'offline';
			return;
		}

		state = 'refreshing';
		try {
			await invalidateAll();
			state = 'online';
		} catch {
			state = 'stale';
		}
	}

	onMount(() => {
		state = navigator.onLine ? 'online' : 'offline';
		const handleOffline = () => (state = 'offline');
		const handleOnline = () => void refreshData();

		window.addEventListener('offline', handleOffline);
		window.addEventListener('online', handleOnline);
		return () => {
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('online', handleOnline);
		};
	});
</script>

<div
	class="flex min-h-9 items-center justify-center gap-2 border-b px-3 py-2 text-xs font-medium {state ===
	'online'
		? 'border-green-200 bg-green-50 text-green-800'
		: state === 'refreshing'
			? 'border-blue-200 bg-blue-50 text-blue-800'
			: 'border-amber-200 bg-amber-50 text-amber-900'}"
	role="status"
	aria-live="polite"
>
	{#if state === 'online'}
		<Cloud class="h-4 w-4" aria-hidden="true" />
		<span>Online · perubahan tersimpan ke akun Anda</span>
	{:else if state === 'refreshing'}
		<RefreshCw class="h-4 w-4 animate-spin" aria-hidden="true" />
		<span>Koneksi pulih · memperbarui data…</span>
	{:else if state === 'offline'}
		<WifiOff class="h-4 w-4 shrink-0" aria-hidden="true" />
		<span>Offline · data dari pukul {loadedTime} mungkin usang; perubahan belum dapat disimpan</span
		>
	{:else}
		<TriangleAlert class="h-4 w-4 shrink-0" aria-hidden="true" />
		<span>Online, tetapi data belum berhasil diperbarui.</span>
		<button type="button" class="underline underline-offset-2" onclick={refreshData}
			>Coba lagi</button
		>
	{/if}
</div>

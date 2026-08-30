<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, Home, RefreshCw, WifiOff } from '@lucide/svelte';

	type Props = {
		status?: number;
		message: string;
		homeHref?: string;
		onretry?: () => void | Promise<void>;
	};

	let { status = 500, message, homeHref = '/beranda', onretry }: Props = $props();
	let online = $state(true);
	let retrying = $state(false);
	let failedAt = $state('');

	let title = $derived(
		!online
			? 'Anda sedang offline'
			: status === 404
				? 'Halaman tidak ditemukan'
				: status === 401 || status === 403
					? 'Akses tidak tersedia'
					: 'Data tidak dapat dimuat'
	);

	onMount(() => {
		online = navigator.onLine;
		failedAt = new Intl.DateTimeFormat('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(new Date());
		const handleOnline = () => (online = true);
		const handleOffline = () => (online = false);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	async function retry() {
		if (!online || retrying) return;
		retrying = true;
		try {
			if (onretry) await onretry();
			else window.location.reload();
		} finally {
			retrying = false;
		}
	}
</script>

<section
	class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center p-6 text-center"
	aria-labelledby="page-error-title"
>
	<div
		class="mb-4 flex h-16 w-16 items-center justify-center rounded-full {!online
			? 'bg-amber-100 text-amber-800'
			: 'bg-destructive/10 text-destructive'}"
		aria-hidden="true"
	>
		{#if online}<AlertTriangle class="h-8 w-8" />{:else}<WifiOff class="h-8 w-8" />{/if}
	</div>
	<div role="alert" aria-live="assertive">
		<h1 id="page-error-title" class="text-xl font-semibold">{title}</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			{online
				? message
				: 'Tidak ada data kosong yang ditampilkan karena server belum dapat dihubungi.'}
		</p>
	</div>
	{#if failedAt}<p class="mt-2 text-xs text-muted-foreground">
			Percobaan terakhir gagal pukul {failedAt}.
		</p>{/if}

	<div class="mt-6 flex flex-wrap justify-center gap-3">
		{#if status !== 404}
			<button
				type="button"
				onclick={retry}
				disabled={!online || retrying}
				class="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<RefreshCw class="h-4 w-4 {retrying ? 'animate-spin' : ''}" />
				{retrying ? 'Mencoba lagi…' : online ? 'Coba lagi' : 'Tunggu koneksi'}
			</button>
		{/if}
		<a
			href={homeHref}
			class="inline-flex min-h-12 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-secondary"
			><Home class="h-4 w-4" />{homeHref === '/' ? 'Ke halaman awal' : 'Ke beranda'}</a
		>
	</div>
</section>

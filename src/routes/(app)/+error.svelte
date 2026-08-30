<script lang="ts">
	import { page } from '$app/state';
	import PageErrorState from '$lib/components/page-error-state.svelte';

	let message = $derived(page.error?.message || 'Terjadi kesalahan saat memuat halaman ini.');
</script>

<svelte:head>
	<title>Halaman Tidak Dapat Dimuat - Buku UMKM</title>
</svelte:head>

<PageErrorState status={page.status} {message} />

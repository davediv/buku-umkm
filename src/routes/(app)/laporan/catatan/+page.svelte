<script lang="ts">
	import { goto } from '$app/navigation';
	import { FileText, Loader2, ChevronLeft, Printer } from '@lucide/svelte';
	import { formatDateLong } from '$lib/utils';
	import type { PageData } from './$types';

	type Period = 'monthly' | 'quarterly' | 'yearly';

	let { data }: { data: PageData } = $props();

	// State
	let loading = $state(false);
	let selectedPeriod = $state<Period>((data.catatan?.period as Period) ?? 'monthly');

	// Keep selectedPeriod in sync with data after navigation
	$effect(() => {
		if (data.catatan?.period) {
			selectedPeriod = data.catatan.period as Period;
		}
	});

	// Derived - cache data.catatan to reduce property access in template
	let catatan = $derived(data.catatan);
	let hasError = $derived(!catatan && data.error);

	// Handle period change
	async function changePeriod(period: Period) {
		if (loading || selectedPeriod === period) return;

		loading = true;
		selectedPeriod = period;

		try {
			await goto(`/laporan/catatan?period=${period}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing period:', e);
		} finally {
			loading = false;
		}
	}

	// Print functionality
	function printReport() {
		window.print();
	}
</script>

<svelte:head>
	<title>Catatan atas Laporan Keuangan - Buku UMKM</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<!-- Header -->
	<header
		class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 print:hidden"
	>
		<div class="max-w-4xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<a
						href="/laporan"
						class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						<ChevronLeft class="w-5 h-5 text-gray-600 dark:text-gray-300" />
					</a>
					<div>
						<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
							Catatan atas Laporan Keuangan
						</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400">Notes to Financial Statements</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={printReport}
						class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
					>
						<Printer class="w-4 h-4" />
						<span class="hidden sm:inline">Cetak</span>
					</button>
				</div>
			</div>

			<!-- Period Selector -->
			<div class="mt-4 flex flex-wrap gap-2">
				{#each ['monthly', 'quarterly', 'yearly'] as period (period)}
					<button
						onclick={() => changePeriod(period as Period)}
						disabled={loading}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50
							{selectedPeriod === period
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}"
					>
						{period === 'monthly' ? 'Bulanan' : period === 'quarterly' ? 'Triwulanan' : 'Tahunan'}
					</button>
				{/each}
			</div>
		</div>
	</header>

	<!-- Loading State -->
	{#if loading}
		<div class="flex items-center justify-center py-20">
			<Loader2 class="w-8 h-8 animate-spin text-blue-600" />
			<span class="ml-2 text-gray-600 dark:text-gray-400">Memuat data...</span>
		</div>
	{:else if hasError}
		<!-- Error State -->
		<div class="max-w-4xl mx-auto px-4 py-12">
			<div
				class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center"
			>
				<FileText class="w-12 h-12 text-red-500 mx-auto mb-4" />
				<h2 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Gagal Memuat Data</h2>
				<p class="text-red-600 dark:text-red-400">
					{data.error || 'Terjadi kesalahan saat memuat catatan atas laporan keuangan'}
				</p>
			</div>
		</div>
	{:else if catatan}
		<!-- Report Content -->
		<main class="max-w-4xl mx-auto px-4 py-8">
			<!-- Print-friendly container -->
			<div
				class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 print:shadow-none print:border-none print:p-0"
			>
				<!-- Report Header -->
				<div class="text-center mb-8 print:mb-6">
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
						CATATAN ATAS LAPORAN KEUANGAN
					</h2>
					<p class="text-gray-600 dark:text-gray-400 mt-1">Notes to Financial Statements</p>
					<div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
						{#if catatan.businessProfile?.name}
							<h3 class="text-xl font-bold text-gray-900 dark:text-white">
								{catatan.businessProfile.name}
							</h3>
						{:else}
							<h3 class="text-xl font-bold text-gray-900 dark:text-white italic">[Nama Usaha]</h3>
						{/if}
						<p class="text-gray-600 dark:text-gray-400 mt-1">
							Periode: {catatan.periodLabel}
						</p>
						<p class="text-sm text-gray-500 dark:text-gray-500 mt-1">
							({formatDateLong(catatan.startDate)} - {formatDateLong(catatan.endDate)})
						</p>
					</div>
				</div>

				<!-- Business Profile Info -->
				{#if catatan.businessProfile}
					<div
						class="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg print:bg-transparent print:p-0"
					>
						<h4 class="font-semibold text-gray-900 dark:text-white mb-2">Informasi Usaha</h4>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
							{#if catatan.businessProfile.address}
								<div>
									<span class="text-gray-500 dark:text-gray-400">Alamat:</span>
									<span class="ml-2 text-gray-900 dark:text-gray-200"
										>{catatan.businessProfile.address}</span
									>
								</div>
							{/if}
							{#if catatan.businessProfile.phone}
								<div>
									<span class="text-gray-500 dark:text-gray-400">Telepon:</span>
									<span class="ml-2 text-gray-900 dark:text-gray-200"
										>{catatan.businessProfile.phone}</span
									>
								</div>
							{/if}
							{#if catatan.businessProfile.npwp}
								<div>
									<span class="text-gray-500 dark:text-gray-400">NPWP:</span>
									<span class="ml-2 text-gray-900 dark:text-gray-200"
										>{catatan.businessProfile.npwp}</span
									>
								</div>
							{/if}
							{#if catatan.businessProfile.ownerName}
								<div>
									<span class="text-gray-500 dark:text-gray-400">Pemilik:</span>
									<span class="ml-2 text-gray-900 dark:text-gray-200"
										>{catatan.businessProfile.ownerName}</span
									>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Accounting Policies Summary -->
				<div
					class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg print:bg-transparent print:p-0"
				>
					<h4 class="font-semibold text-blue-900 dark:text-blue-200 mb-3">
						Kebijakan Akuntansi / Accounting Policies
					</h4>
					<div class="space-y-2 text-sm">
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
							<span class="text-blue-700 dark:text-blue-300">Dasar Akuntansi:</span>
							<span class="sm:col-span-2 text-gray-900 dark:text-gray-200">
								{catatan.accountingPolicies.basisAccounting}
							</span>
						</div>
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
							<span class="text-blue-700 dark:text-blue-300">Kerangka Akuntansi:</span>
							<span class="sm:col-span-2 text-gray-900 dark:text-gray-200">
								{catatan.accountingPolicies.framework}
							</span>
						</div>
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
							<span class="text-blue-700 dark:text-blue-300">Mata Uang:</span>
							<span class="sm:col-span-2 text-gray-900 dark:text-gray-200">
								{catatan.accountingPolicies.currency}
							</span>
						</div>
					</div>
				</div>

				<!-- Notes Sections -->
				<div class="space-y-6">
					{#each catatan.notesSections as section (section.title)}
						<div class="break-inside-avoid">
							<h4 class="font-semibold text-gray-900 dark:text-white mb-2">
								{section.title}
							</h4>
							<p
								class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line"
							>
								{section.content}
							</p>
						</div>
					{/each}
				</div>

				<!-- Footer -->
				<div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 print:mt-6 print:pt-4">
					<p class="text-xs text-gray-500 dark:text-gray-500 text-center">
						Dokumen ini generada secara otomatis oleh Buku UMKM
					</p>
					<p class="text-xs text-gray-400 dark:text-gray-600 text-center mt-1">
						Tanggal cetak: {formatDateLong(new Date().toISOString().split('T')[0])}
					</p>
				</div>
			</div>
		</main>
	{:else}
		<!-- Empty State -->
		<div class="max-w-4xl mx-auto px-4 py-12">
			<div
				class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center"
			>
				<FileText class="w-12 h-12 text-yellow-500 mx-auto mb-4" />
				<h2 class="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
					Data Tidak Ditemukan
				</h2>
				<p class="text-yellow-600 dark:text-yellow-400">
					Silakan lengkapi profil usaha Anda terlebih dahulu untuk melihat catatan atas laporan
					keuangan.
				</p>
				<a
					href="/pengaturan"
					class="inline-block mt-4 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
				>
					Pengaturan Usaha
				</a>
			</div>
		</div>
	{/if}
</div>

<!-- Print Styles -->
<style>
	@media print {
		:global(body) {
			background: white !important;
		}
		:global(.print\:hidden) {
			display: none !important;
		}
		:global(.print\:shadow-none) {
			box-shadow: none !important;
		}
		:global(.print\:border-none) {
			border: none !important;
		}
		:global(.print\:p-0) {
			padding: 0 !important;
		}
		:global(.print\:bg-transparent) {
			background: transparent !important;
		}
		:global(.print\:mb-6) {
			margin-bottom: 1.5rem !important;
		}
		:global(.print\:mt-6) {
			margin-top: 1.5rem !important;
		}
		:global(.print\:pt-4) {
			padding-top: 1rem !important;
		}
		:global(.break-inside-avoid) {
			break-inside: avoid;
		}
	}
</style>

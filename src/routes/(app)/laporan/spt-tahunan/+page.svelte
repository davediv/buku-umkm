<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		AlertCircle,
		ArrowLeft,
		Calendar,
		Download,
		FileSpreadsheet,
		Loader2,
		Wallet
	} from '@lucide/svelte';
	import ReportNavigation from '$lib/components/reports/report-navigation.svelte';
	import { toast } from '$lib/components/ui/toast';
	import { todayInJakarta } from '$lib/shared/dates';
	import { formatRupiah } from '$lib/utils';
	import {
		exportSPTToExcel,
		exportSPTToPDF,
		generateSPTFilename,
		type SPTBusinessProfile,
		type SPTTaxData
	} from '$lib/utils/spt-export';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const currentYear = Number(todayInJakarta().slice(0, 4));
	const availableYears = Array.from({ length: 6 }, (_, index) => currentYear - index);

	function resolveYear(value: string | null): number {
		const year = Number(value);
		return Number.isInteger(year) && availableYears.includes(year) ? year : currentYear;
	}

	let selectedYear = $derived(resolveYear(page.url.searchParams.get('year')));
	let sptData = $state<SPTTaxData | null>(null);
	let loading = $state(true);
	let exportLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let requestSequence = 0;

	async function fetchReport(year: number) {
		const requestId = ++requestSequence;
		loading = true;
		errorMessage = null;
		sptData = null;

		try {
			const response = await fetch(`/api/tax/annual?year=${year}`);
			const result = (await response.json()) as { data?: SPTTaxData; error?: string };
			if (!response.ok) throw new Error(result.error || 'Estimasi pajak tidak tersedia.');
			if (!result.data) throw new Error('Data tahunan tidak tersedia.');
			if (requestId === requestSequence) sptData = result.data;
		} catch (error) {
			if (requestId === requestSequence) {
				errorMessage = error instanceof Error ? error.message : 'Estimasi pajak tidak tersedia.';
			}
		} finally {
			if (requestId === requestSequence) loading = false;
		}
	}

	$effect(() => {
		void fetchReport(selectedYear);
	});

	async function changeYear(event: Event) {
		const year = Number((event.currentTarget as HTMLSelectElement).value);
		await goto(`/laporan/spt-tahunan?year=${year}`, { replaceState: true, noScroll: true });
	}

	function getBusinessProfile(taxpayerType: string): SPTBusinessProfile {
		return {
			name: data.businessProfile?.name ?? '',
			address: data.businessProfile?.address ?? '',
			npwp: data.businessProfile?.npwp ?? '',
			ownerName: data.businessProfile?.ownerName ?? '',
			taxpayerType
		};
	}

	async function exportReport(format: 'pdf' | 'xlsx') {
		if (!sptData || exportLoading) return;

		exportLoading = true;
		try {
			const profile = getBusinessProfile(sptData.taxpayerType);
			if (format === 'pdf') {
				await exportSPTToPDF(sptData, profile, generateSPTFilename(selectedYear, 'pdf'));
			} else {
				await exportSPTToExcel(sptData, profile, generateSPTFilename(selectedYear, 'xlsx'));
			}
			toast.success('Berhasil mengekspor', `Draft tahun ${selectedYear} telah diunduh`);
		} catch (error) {
			console.error('Error exporting annual tax draft:', error);
			toast.error('Gagal mengekspor', 'Coba ulangi setelah memastikan data telah termuat');
		} finally {
			exportLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Draft SPT Tahunan - Buku UMKM</title>
</svelte:head>

<div class="space-y-6 p-4 md:p-6">
	<header class="flex items-center gap-4 print:hidden">
		<a
			href="/laporan"
			class="rounded-lg p-2 transition-colors hover:bg-accent"
			aria-label="Kembali ke daftar laporan"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Draft SPT Tahunan</h1>
			<p class="text-sm text-muted-foreground">Rekap pendukung estimasi PPh Final UMKM</p>
		</div>
	</header>

	<ReportNavigation />

	<div class="flex justify-center print:hidden">
		<label class="flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3" for="report-year">
			<Calendar class="h-4 w-4 text-muted-foreground" />
			<span class="text-sm font-medium">Tahun</span>
			<select
				id="report-year"
				value={selectedYear}
				onchange={changeYear}
				class="bg-transparent py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{#each availableYears as year (year)}
					<option value={year}>{year}</option>
				{/each}
			</select>
		</label>
	</div>

	{#if loading}
		<div class="flex min-h-64 flex-col items-center justify-center gap-3" aria-live="polite">
			<Loader2 class="h-8 w-8 animate-spin text-primary" />
			<p class="text-sm text-muted-foreground">Memuat draft tahun {selectedYear}…</p>
		</div>
	{:else if errorMessage}
		<section
			class="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
		>
			<AlertCircle class="mx-auto mb-3 h-8 w-8" />
			<h2 class="font-semibold">Draft belum dapat dibuat</h2>
			<p class="mt-2 text-sm leading-6">{errorMessage}</p>
			<div class="mt-4 flex flex-wrap justify-center gap-3">
				<button
					type="button"
					onclick={() => fetchReport(selectedYear)}
					class="inline-flex min-h-11 items-center rounded-md border border-amber-300 px-4 text-sm font-medium"
				>
					Coba lagi
				</button>
				<a
					href="/pajak/profil?year={selectedYear}"
					class="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
				>
					Tinjau profil pajak
				</a>
			</div>
		</section>
	{:else if sptData}
		<div class="flex flex-wrap justify-end gap-2 print:hidden">
			<button
				type="button"
				onclick={() => exportReport('xlsx')}
				disabled={exportLoading}
				class="inline-flex min-h-11 items-center gap-2 rounded-md bg-green-700 px-4 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50"
			>
				{#if exportLoading}<Loader2 class="h-4 w-4 animate-spin" />{:else}<FileSpreadsheet
						class="h-4 w-4"
					/>{/if}
				Ekspor Excel
			</button>
			<button
				type="button"
				onclick={() => exportReport('pdf')}
				disabled={exportLoading}
				class="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
			>
				{#if exportLoading}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Download
						class="h-4 w-4"
					/>{/if}
				Ekspor PDF
			</button>
		</div>

		<section class="space-y-4 rounded-xl border bg-card p-4 md:p-6">
			<div class="flex items-center gap-2">
				<Wallet class="h-5 w-5" />
				<h2 class="font-semibold">Ringkasan Tahun {sptData.year}</h2>
			</div>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-sm text-muted-foreground">Omzet bruto agregat</p>
					<p class="text-xl font-semibold">{formatRupiah(sptData.summary.totalGrossRevenue)}</p>
				</div>
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-sm text-muted-foreground">PPh Final terutang</p>
					<p class="text-xl font-semibold">{formatRupiah(sptData.summary.totalTaxDue)}</p>
				</div>
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-sm text-muted-foreground">PPh Final dibayar</p>
					<p class="text-xl font-semibold">{formatRupiah(sptData.summary.totalTaxPaid)}</p>
				</div>
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-sm text-muted-foreground">Pengeluaran tercatat</p>
					<p class="text-xl font-semibold">{formatRupiah(sptData.summary.totalExpenses)}</p>
				</div>
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-sm text-muted-foreground">Pendapatan bersih tercatat</p>
					<p class="text-xl font-semibold">{formatRupiah(sptData.summary.netIncome)}</p>
				</div>
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-sm text-muted-foreground">Status fasilitas omzet</p>
					<p class="text-xl font-semibold">
						{sptData.summary.thresholdExceeded ? 'Ambang terlewati' : 'Belum terlewati'}
					</p>
				</div>
			</div>
		</section>

		<section class="rounded-xl border bg-card p-4 md:p-6">
			<h2 class="mb-4 font-semibold">Rekapitulasi Bulanan</h2>
			<div class="space-y-3 md:hidden">
				{#each sptData.months as month (month.month)}
					<article class="rounded-lg border p-4">
						<div class="flex items-center justify-between gap-3">
							<h3 class="font-medium">{month.monthName}</h3>
							<span
								class="rounded-full px-2 py-1 text-xs font-medium {month.taxStatus === 'PAID'
									? 'bg-green-100 text-green-700'
									: 'bg-amber-100 text-amber-800'}"
							>
								{month.taxStatus === 'PAID' ? 'Lunas' : 'Belum lunas'}
							</span>
						</div>
						<dl class="mt-3 grid gap-2 text-sm">
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">Omzet bruto</dt>
								<dd class="font-medium">{formatRupiah(month.grossRevenue)}</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">Omzet kena pajak</dt>
								<dd>{formatRupiah(month.taxableRevenue)}</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">PPh Final</dt>
								<dd>{formatRupiah(month.taxAmount)}</dd>
							</div>
						</dl>
					</article>
				{/each}
			</div>
			<div class="hidden overflow-x-auto md:block">
				<table class="w-full min-w-[720px] text-sm">
					<thead>
						<tr class="border-b">
							<th scope="col" class="px-3 py-2 text-left">Bulan</th>
							<th scope="col" class="px-3 py-2 text-right">Omzet bruto</th>
							<th scope="col" class="px-3 py-2 text-right">Omzet kena pajak</th>
							<th scope="col" class="px-3 py-2 text-right">PPh Final</th>
							<th scope="col" class="px-3 py-2 text-center">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each sptData.months as month (month.month)}
							<tr class="border-b">
								<td class="px-3 py-2">{month.monthName}</td>
								<td class="px-3 py-2 text-right">{formatRupiah(month.grossRevenue)}</td>
								<td class="px-3 py-2 text-right">{formatRupiah(month.taxableRevenue)}</td>
								<td class="px-3 py-2 text-right">{formatRupiah(month.taxAmount)}</td>
								<td class="px-3 py-2 text-center">
									{month.taxStatus === 'PAID' ? 'Lunas' : 'Belum lunas'}
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="bg-muted/50 font-semibold">
							<td class="px-3 py-2">Total</td>
							<td class="px-3 py-2 text-right">{formatRupiah(sptData.summary.totalGrossRevenue)}</td
							>
							<td class="px-3 py-2 text-right"
								>{formatRupiah(sptData.summary.totalTaxableRevenue)}</td
							>
							<td class="px-3 py-2 text-right">{formatRupiah(sptData.summary.totalTaxDue)}</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</section>

		<p
			class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
		>
			Dokumen ini adalah draft pendukung berbasis data dan profil yang Anda konfirmasi. Dokumen ini
			bukan formulir SPT, bukti lapor, kode billing, atau ketetapan resmi DJP.
		</p>
	{/if}
</div>

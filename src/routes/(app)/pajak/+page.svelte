<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		AlertCircle,
		CheckCircle2,
		Circle,
		ExternalLink,
		Plus,
		Receipt,
		Settings2
	} from '@lucide/svelte';
	import PageErrorState from '$lib/components/page-error-state.svelte';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { TAX_STATUS, TAXPAYER_TYPE, getIndonesianMonthName } from '$lib/tax/config';
	import { formatRupiah } from '$lib/utils';
	import { toast } from '$lib/components/ui/toast';
	import {
		AlertDialog,
		AlertDialogTitle,
		AlertDialogDescription,
		AlertDialogAction,
		AlertDialogCancel
	} from '$lib/components/ui/alert-dialog';
	import type { TaxEligibilityDecision, TaxpayerType } from '$lib/tax/types';

	interface TaxSummary {
		year: number;
		month: number;
		currentMonthRevenue: number;
		currentMonthTax: number | null;
		cumulativeAnnualRevenue: number;
		thresholdPercentage: number;
		thresholdAmount: number;
		paymentStatus: string | null;
		taxableRevenue: number | null;
		isBelowThreshold: boolean | null;
		taxpayerType: TaxpayerType | null;
		calculationStatus: 'estimate' | 'unavailable';
		profileConfigured: boolean;
		eligibility: TaxEligibilityDecision;
	}

	interface TaxHistoryMonth {
		year: number;
		month: number;
		grossRevenue: number;
		taxableRevenue: number | null;
		taxAmount: number | null;
		taxRate: number | null;
		status: string | null;
		paymentDate: string | null;
		billingCode: string | null;
		isBelowThreshold: boolean | null;
		cumulativeRevenue: number;
		thresholdPercentage: number | null;
	}

	interface TaxHistory {
		year: number;
		taxpayerType: TaxpayerType | null;
		calculationStatus: 'estimate' | 'unavailable';
		profileConfigured: boolean;
		eligibility: TaxEligibilityDecision;
		totalGrossRevenue: number;
		totalTaxableRevenue: number | null;
		totalTaxAmount: number | null;
		thresholdInfo: {
			threshold: number;
			currentRevenue: number;
			percentage: number;
			isExceeded: boolean;
			thresholdExceededMonth: number | null;
		};
		summary: {
			totalMonths: number;
			monthsWithTax: number;
			paidMonths: number;
			unpaidMonths: number;
		};
		months: TaxHistoryMonth[];
	}

	interface PageData {
		summary: TaxSummary | null;
		history: TaxHistory | null;
		error: string | null;
	}

	let { data }: { data: PageData } = $props();

	// State
	let showConfirmDialog = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Get progress bar color class
	function getProgressBarColor(percentage: number): string {
		if (percentage < 70) return 'bg-green-500';
		if (percentage < 90) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	// Get status badge
	function getStatusBadge(status: string, hasTax: boolean) {
		if (!hasTax) {
			return { label: 'Tidak Kena Pajak', class: 'bg-gray-100 text-gray-600' };
		}
		switch (status) {
			case TAX_STATUS.PAID:
				return { label: 'Sudah Dibayar', class: 'bg-green-100 text-green-700' };
			case TAX_STATUS.OVERDUE:
				return { label: 'Jatuh Tempo', class: 'bg-red-100 text-red-700' };
			default:
				return { label: 'Belum Dibayar', class: 'bg-yellow-100 text-yellow-700' };
		}
	}

	// Handle mark as paid
	async function handleMarkAsPaid() {
		if (!data.summary) return;

		loading = true;
		error = null;

		try {
			const response = await fetch(
				`/api/tax/${data.summary.year}/${data.summary.month}/mark-paid`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }
				}
			);

			if (!response.ok) {
				const errJson = (await response.json()) as { error?: string };
				throw new Error(errJson.error || 'Failed to mark tax as paid');
			}

			// Refresh page data - the page will reload with updated payment status
			goto('/pajak', { invalidateAll: true });
		} catch (err) {
			console.error('Error marking tax as paid:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to mark tax as paid';
			error = errorMessage;
			toast.error('Gagal menandai pajak', errorMessage);
		} finally {
			loading = false;
		}
	}

	// Check if should show 80% or 100% alert
	function showThresholdAlert(percentage: number): 'none' | 'warning' | 'critical' {
		if (percentage >= 100) return 'critical';
		if (percentage >= 80) return 'warning';
		return 'none';
	}
</script>

<svelte:head>
	<title>Pajak — Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold">Pajak</h1>
			<p class="text-sm text-muted-foreground">Estimasi PPh Final UMKM 0,5%</p>
		</div>
		<a
			href="/pajak/profil?year={data.summary?.year ?? new Date().getFullYear()}"
			class="inline-flex h-10 items-center justify-center gap-2 rounded-md border bg-background px-4 font-medium transition-colors hover:bg-muted"
		>
			<Settings2 class="h-4 w-4" />
			Profil pajak
		</a>
	</div>

	{#if data.error}
		<PageErrorState message={data.error} />
	{/if}

	{#if data.summary?.calculationStatus === 'unavailable'}
		<section class="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
			<div class="flex items-start gap-3">
				<AlertCircle class="mt-0.5 h-5 w-5 flex-shrink-0" />
				<div class="space-y-2">
					<h2 class="font-semibold">
						{data.summary.profileConfigured
							? 'Estimasi belum dapat ditampilkan'
							: `Lengkapi profil pajak ${data.summary.year}`}
					</h2>
					{#each data.summary.eligibility.reasons as reason (reason)}
						<p class="text-sm">{reason}</p>
					{/each}
				</div>
			</div>
			<a
				href="/pajak/profil?year={data.summary.year}"
				class="inline-flex h-10 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
			>
				{data.summary.profileConfigured ? 'Tinjau profil pajak' : 'Isi profil pajak'}
			</a>
		</section>
	{:else if data.summary}
		<!-- Tax Summary Card -->
		<div class="bg-card border rounded-lg p-6 space-y-6">
			<!-- WP OP Threshold Progress Bar -->
			{#if data.summary.taxpayerType === TAXPAYER_TYPE.WP_OP}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">Fasilitas omzet WP Orang Pribadi</span>
						<span class="text-sm text-muted-foreground">
							{formatRupiah(data.summary.cumulativeAnnualRevenue)} dari {formatRupiah(
								data.summary.thresholdAmount
							)}
						</span>
					</div>

					<!-- Progress Bar -->
					<div class="w-full bg-muted rounded-full h-4 overflow-hidden">
						<div
							class="h-full {getProgressBarColor(
								data.summary.thresholdPercentage
							)} transition-all duration-500"
							style="width: {Math.min(data.summary.thresholdPercentage, 100)}%"
						></div>
					</div>

					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>0%</span>
						<span
							class="font-medium {data.summary.thresholdPercentage >= 70
								? 'text-yellow-600'
								: ''} {data.summary.thresholdPercentage >= 90 ? 'text-red-600' : ''}"
						>
							{data.summary.thresholdPercentage.toFixed(1)}%
						</span>
						<span>100%</span>
					</div>

					<!-- Threshold Alerts -->
					{#if showThresholdAlert(data.summary.thresholdPercentage) === 'warning'}
						<div
							class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-yellow-700"
						>
							<AlertCircle class="w-4 h-4 flex-shrink-0" />
							<span class="text-sm"
								>Omzet sudah mencapai 80% dari fasilitas Rp500 juta. Tinjau kesiapan pajak.</span
							>
						</div>
					{:else if showThresholdAlert(data.summary.thresholdPercentage) === 'critical'}
						<div
							class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700"
						>
							<AlertCircle class="w-4 h-4 flex-shrink-0" />
							<span class="text-sm"
								>Omzet sudah melewati fasilitas Rp500 juta. Bagian omzet berikutnya masuk dasar
								estimasi PPh Final.</span
							>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Current Month Tax Info -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div>
					<p class="text-sm text-muted-foreground">
						Estimasi bulan {getIndonesianMonthName(data.summary.month)}
						{data.summary.year}
					</p>
					{#if data.summary.isBelowThreshold}
						<p class="text-2xl font-bold text-green-600">Belum kena pajak</p>
					{:else}
						<p class="text-2xl font-bold">{formatRupiah(data.summary.currentMonthTax ?? 0)}</p>
					{/if}
				</div>

				<div>
					<p class="text-sm text-muted-foreground">Status Pembayaran</p>
					<div class="flex items-center gap-2 mt-1">
						{#if (data.summary.currentMonthTax ?? 0) <= 0}
							<Circle class="w-5 h-5 text-gray-400" />
							<span class="text-lg font-medium text-muted-foreground">Tidak ada pembayaran</span>
						{:else if data.summary.paymentStatus === TAX_STATUS.PAID}
							<CheckCircle2 class="w-5 h-5 text-green-600" />
							<span class="text-lg font-medium text-green-600">Sudah Dibayar</span>
						{:else}
							<Circle class="w-5 h-5 text-yellow-600" />
							<span class="text-lg font-medium text-yellow-600">Belum Dibayar</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Mark as Paid Button -->
			<div class="flex flex-wrap gap-3">
				{#if data.summary.paymentStatus !== TAX_STATUS.PAID && (data.summary.currentMonthTax ?? 0) > 0}
					<button
						onclick={() => (showConfirmDialog = true)}
						class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium transition-colors"
					>
						<CheckCircle2 class="w-4 h-4" />
						Tandai Sudah Dibayar
					</button>
				{/if}
				{#if (data.summary.currentMonthTax ?? 0) > 0}
					<a
						href="/pajak/kode-billing/{data.summary.year}/{data.summary.month}"
						class="inline-flex items-center justify-center gap-2 border bg-background hover:bg-muted h-10 px-4 py-2 rounded-md font-medium transition-colors"
					>
						<Receipt class="w-4 h-4" />
						Panduan pembayaran
					</a>
				{/if}
			</div>

			<div class="border-t pt-4 text-sm text-muted-foreground">
				<p>
					Hasil ini adalah estimasi berdasarkan data yang Anda konfirmasi, bukan ketetapan pajak
					atau kode billing resmi.
				</p>
				<a
					href={data.summary.eligibility.rule.sourceUrl}
					target="_blank"
					rel="noreferrer"
					class="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
				>
					Dasar aturan: {data.summary.eligibility.rule.name}
					<ExternalLink class="h-3.5 w-3.5" />
				</a>
			</div>
		</div>
	{/if}

	<!-- Tax History Table -->
	{#if data.history?.calculationStatus === 'estimate' && data.history.months.length > 0}
		<div class="bg-card border rounded-lg overflow-hidden">
			<div class="p-4 border-b">
				<h2 class="text-lg font-semibold">Riwayat estimasi pajak {data.history.year}</h2>
			</div>

			<div class="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead class="w-[50px]"></TableHead>
							<TableHead>Bulan</TableHead>
							<TableHead class="text-right">Pendapatan Kotor</TableHead>
							<TableHead class="text-right">Pajak</TableHead>
							<TableHead>Status</TableHead>
							<TableHead class="w-[100px]"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each data.history.months as record (record.year + '-' + record.month)}
							{@const statusBadge = getStatusBadge(
								record.status ?? '',
								record.taxAmount !== null && record.taxAmount > 0
							)}
							<TableRow>
								<TableCell>
									{#if record.status === TAX_STATUS.PAID}
										<CheckCircle2 class="w-4 h-4 text-green-600" />
									{:else if (record.taxAmount ?? 0) > 0}
										<Circle class="w-4 h-4 text-yellow-600" />
									{:else}
										<Circle class="w-4 h-4 text-gray-400" />
									{/if}
								</TableCell>
								<TableCell class="font-medium">
									<a
										href="/pajak/kode-billing/{record.year}/{record.month}"
										class="hover:underline"
									>
										{getIndonesianMonthName(record.month)}
									</a>
								</TableCell>
								<TableCell class="text-right">{formatRupiah(record.grossRevenue)}</TableCell>
								<TableCell class="text-right">
									{#if record.isBelowThreshold}
										<span class="text-muted-foreground">-</span>
									{:else}
										{formatRupiah(record.taxAmount ?? 0)}
									{/if}
								</TableCell>
								<TableCell>
									<span
										class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {statusBadge.class}"
									>
										{statusBadge.label}
									</span>
								</TableCell>
								<TableCell>
									{#if (record.taxAmount ?? 0) > 0}
										<a
											href="/pajak/kode-billing/{record.year}/{record.month}"
											class="text-primary hover:underline text-sm"
										>
											Panduan
										</a>
									{/if}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		</div>
	{:else if data.history?.calculationStatus === 'estimate'}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
				<Receipt class="w-8 h-8 text-muted-foreground" />
			</div>
			<h3 class="text-lg font-medium mb-2">Belum ada pemasukan tercatat.</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				Catat transaksi pemasukan Anda untuk melihat perhitungan pajak.
			</p>
			<a
				href="/transaksi/tambah"
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-3 min-h-[48px] text-base rounded-md font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Tambah Transaksi
			</a>
		</div>
	{/if}

	<!-- Confirmation Dialog -->
	<AlertDialog
		open={showConfirmDialog}
		closeOnExternalClick={!loading}
		onopenchange={(open) => {
			if (!open) {
				showConfirmDialog = false;
				error = null;
			}
		}}
	>
		<AlertDialogTitle>Konfirmasi Pembayaran Pajak</AlertDialogTitle>
		<AlertDialogDescription>
			Apakah Anda yakin ingin menandai pajak bulan {data.summary
				? getIndonesianMonthName(data.summary.month)
				: ''}
			{data.summary?.year || ''} sebagai sudah dibayar?
		</AlertDialogDescription>

		{#if data.summary && (data.summary.currentMonthTax ?? 0) > 0}
			<div class="bg-muted rounded-lg p-4 mt-4 mb-4">
				<p class="text-sm text-muted-foreground">Jumlah Pajak</p>
				<p class="text-xl font-bold">{formatRupiah(data.summary.currentMonthTax ?? 0)}</p>
			</div>
		{/if}

		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
				{error}
			</div>
		{/if}

		<div class="flex gap-3 justify-end mt-6">
			<AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
			<AlertDialogAction variant="default" onclick={handleMarkAsPaid} {loading}>
				{loading ? 'Menyimpan...' : 'Ya, Tandai Sudah Dibayar'}
			</AlertDialogAction>
		</div>
	</AlertDialog>
</div>

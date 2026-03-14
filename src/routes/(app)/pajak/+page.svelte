<script lang="ts">
	import { goto } from '$app/navigation';
	import { AlertCircle, CheckCircle2, Circle, Plus, Receipt } from '@lucide/svelte';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { TAX_STATUS } from '$lib/tax/config';
	import { formatRupiah } from '$lib/tax/engine';
	import type { TaxpayerType } from '$lib/tax/types';

	// Types for page data
	interface TaxSummary {
		year: number;
		month: number;
		currentMonthRevenue: number;
		currentMonthTax: number;
		cumulativeAnnualRevenue: number;
		thresholdPercentage: number;
		thresholdAmount: number;
		paymentStatus: string;
		taxableRevenue: number;
		isBelowThreshold: boolean;
		taxpayerType: TaxpayerType;
	}

	interface TaxHistoryMonth {
		year: number;
		month: number;
		grossRevenue: number;
		taxableRevenue: number;
		taxAmount: number;
		taxRate: number;
		status: string;
		paymentDate: string | null;
		billingCode: string | null;
		isBelowThreshold: boolean;
		cumulativeRevenue: number;
		thresholdPercentage: number;
	}

	interface TaxHistory {
		year: number;
		taxpayerType: TaxpayerType;
		totalGrossRevenue: number;
		totalTaxableRevenue: number;
		totalTaxAmount: number;
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

	let { data } = $props<{ data: PageData }>();

	// State
	let showConfirmDialog = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Format month name
	function getMonthName(month: number): string {
		const months = [
			'Januari',
			'Februari',
			'Maret',
			'April',
			'Mei',
			'Juni',
			'Juli',
			'Agustus',
			'September',
			'Oktober',
			'November',
			'Desember'
		];
		return months[month - 1] || '';
	}

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
			error = 'Failed to mark tax as paid';
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

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold">Pajak</h1>
			<p class="text-sm text-muted-foreground">Ringkasan pajak PPh Final 0.5%</p>
		</div>
	</div>

	{#if data.error}
		<div
			class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700"
		>
			<AlertCircle class="w-5 h-5 flex-shrink-0" />
			<p>{data.error}</p>
		</div>
	{/if}

	<!-- Tax Summary Card -->
	{#if data.summary}
		<div class="bg-card border rounded-lg p-6 space-y-6">
			<!-- WP OP Threshold Progress Bar -->
			{#if data.summary.taxpayerType === 'WP_OP'}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">Batas Penghasilan Tidak Kena Pajak (PTKP)</span>
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
								>Penghasilan sudah mencapai 80% dari batas PTKP. Siapkan dana pajak.</span
							>
						</div>
					{:else if showThresholdAlert(data.summary.thresholdPercentage) === 'critical'}
						<div
							class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700"
						>
							<AlertCircle class="w-4 h-4 flex-shrink-0" />
							<span class="text-sm"
								>Penghasilan sudah melebihi batas PTKP! Pajak PPh Final 0.5% sudah wajib dibayar.</span
							>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Current Month Tax Info -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div>
					<p class="text-sm text-muted-foreground">
						Pajak Bulan {getMonthName(data.summary.month)}
						{data.summary.year}
					</p>
					{#if data.summary.isBelowThreshold}
						<p class="text-2xl font-bold text-green-600">Belum kena pajak</p>
					{:else}
						<p class="text-2xl font-bold">{formatRupiah(data.summary.currentMonthTax)}</p>
					{/if}
				</div>

				<div>
					<p class="text-sm text-muted-foreground">Status Pembayaran</p>
					<div class="flex items-center gap-2 mt-1">
						{#if data.summary.paymentStatus === TAX_STATUS.PAID}
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
				{#if data.summary.paymentStatus !== TAX_STATUS.PAID && !data.summary.isBelowThreshold}
					<button
						onclick={() => (showConfirmDialog = true)}
						class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium transition-colors"
					>
						<CheckCircle2 class="w-4 h-4" />
						Tandai Sudah Dibayar
					</button>
				{/if}
				{#if !data.summary.isBelowThreshold}
					<a
						href="/pajak/kode-billing/{data.summary.year}/{data.summary.month}"
						class="inline-flex items-center justify-center gap-2 border bg-background hover:bg-muted h-10 px-4 py-2 rounded-md font-medium transition-colors"
					>
						<Receipt class="w-4 h-4" />
						Kode Billing
					</a>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Tax History Table -->
	{#if data.history && data.history.months.length > 0}
		<div class="bg-card border rounded-lg overflow-hidden">
			<div class="p-4 border-b">
				<h2 class="text-lg font-semibold">Riwayat Pajak {data.history.year}</h2>
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
							{@const statusBadge = getStatusBadge(record.status, !record.isBelowThreshold)}
							<TableRow>
								<TableCell>
									{#if record.status === TAX_STATUS.PAID}
										<CheckCircle2 class="w-4 h-4 text-green-600" />
									{:else if record.taxAmount > 0}
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
										{getMonthName(record.month)}
									</a>
								</TableCell>
								<TableCell class="text-right">{formatRupiah(record.grossRevenue)}</TableCell>
								<TableCell class="text-right">
									{#if record.isBelowThreshold}
										<span class="text-muted-foreground">-</span>
									{:else}
										{formatRupiah(record.taxAmount)}
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
									{#if !record.isBelowThreshold}
										<a
											href="/pajak/kode-billing/{record.year}/{record.month}"
											class="text-primary hover:underline text-sm"
										>
											Kode Billing
										</a>
									{/if}
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		</div>
	{:else if data.history}
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
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Tambah Transaksi
			</a>
		</div>
	{/if}

	<!-- Confirmation Dialog -->
	{#if showConfirmDialog}
		<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
			<div class="bg-background border rounded-lg shadow-lg max-w-md w-full p-6">
				<h3 class="text-lg font-semibold mb-2">Konfirmasi Pembayaran Pajak</h3>
				<p class="text-muted-foreground mb-4">
					Apakah Anda yakin ingin menandai pajak bulan {data.summary
						? getMonthName(data.summary.month)
						: ''}
					{data.summary?.year || ''} sebagai sudah dibayar?
				</p>

				{#if data.summary && !data.summary.isBelowThreshold}
					<div class="bg-muted rounded-lg p-4 mb-4">
						<p class="text-sm text-muted-foreground">Jumlah Pajak</p>
						<p class="text-xl font-bold">{formatRupiah(data.summary.currentMonthTax)}</p>
					</div>
				{/if}

				{#if error}
					<div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
						{error}
					</div>
				{/if}

				<div class="flex gap-3 justify-end">
					<button
						onclick={() => {
							showConfirmDialog = false;
							error = null;
						}}
						class="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
						disabled={loading}
					>
						Batal
					</button>
					<button
						onclick={handleMarkAsPaid}
						class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
						disabled={loading}
					>
						{loading ? 'Menyimpan...' : 'Ya, Tandai Sudah Dibayar'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

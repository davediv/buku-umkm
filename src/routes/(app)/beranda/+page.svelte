<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		TrendingUp,
		TrendingDown,
		Wallet,
		ArrowUpRight,
		ArrowDownRight,
		Clock,
		Receipt,
		ChevronRight,
		Loader2,
		Plus
	} from '@lucide/svelte';
	import { CashFlowChart } from '$lib/components/ui/charts';
	import { formatRupiah, formatDateSlash } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let loading = $state(false);
	let selectedPeriod = $state<'daily' | 'weekly' | 'monthly'>('monthly');

	// Derived
	let dashboard = $derived(data.dashboard);
	let hasError = $derived(!dashboard && data.error);

	// Handle period change
	async function changePeriod(period: 'daily' | 'weekly' | 'monthly') {
		if (loading || selectedPeriod === period) return;

		loading = true;
		selectedPeriod = period;

		try {
			await goto(`/beranda?period=${period}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing period:', e);
		} finally {
			loading = false;
		}
	}

	// Calculate tax progress percentage
	function getTaxProgress(revenue: number, threshold: number): number {
		if (threshold === 0) return 0;
		return Math.min((revenue / threshold) * 100, 100);
	}

	// Transaction type helpers
	function getTransactionIcon(type: string) {
		return type === 'income' ? ArrowUpRight : ArrowDownRight;
	}
</script>

<svelte:head>
	<title>Beranda - Buku UMKM</title>
</svelte:head>

<div class="space-y-6 p-4 md:p-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Beranda</h1>
		<p class="text-sm text-muted-foreground">Ringkasan keuangan bisnis Anda</p>
	</div>

	{#if hasError}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
				<Receipt class="h-8 w-8 text-destructive" />
			</div>
			<h2 class="mb-2 text-lg font-medium">Gagal memuat data</h2>
			<p class="mb-6 max-w-sm text-sm text-muted-foreground">
				{data.error || 'Terjadi kesalahan saat memuat data dashboard'}
			</p>
			<button
				onclick={() => goto('/beranda')}
				class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Coba Lagi
			</button>
		</div>
	{:else if !dashboard}
		<!-- Skeleton Loading State -->
		<div class="animate-pulse space-y-6">
			<!-- Hero Card Skeleton -->
			<div class="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
				<div class="mb-2 h-4 w-24 rounded bg-primary/10"></div>
				<div class="h-10 w-48 rounded bg-primary/10"></div>
			</div>

			<!-- Summary Cards Skeleton -->
			<div class="grid gap-4 md:grid-cols-3">
				{#each [1, 2, 3] as i (i)}
					<div class="rounded-xl border bg-card p-4">
						<div class="mb-2 h-4 w-16 rounded bg-muted"></div>
						<div class="h-8 w-32 rounded bg-muted"></div>
					</div>
				{/each}
			</div>

			<!-- Chart Skeleton -->
			<div class="h-64 rounded-xl border bg-card p-4">
				<div class="mb-4 h-4 w-32 rounded bg-muted"></div>
				<div class="flex h-40 items-end justify-around gap-2">
					{#each [1, 2, 3, 4, 5, 6] as i (i)}
						<div class="flex-1 rounded-t bg-muted"></div>
					{/each}
				</div>
			</div>

			<!-- Recent Transactions Skeleton -->
			<div class="rounded-xl border bg-card p-4">
				<div class="mb-4 h-4 w-32 rounded bg-muted"></div>
				{#each [1, 2, 3] as i (i)}
					<div class="flex items-center gap-4 border-b py-3 last:border-0">
						<div class="h-10 w-10 rounded-full bg-muted"></div>
						<div class="flex-1">
							<div class="mb-1 h-4 w-32 rounded bg-muted"></div>
							<div class="h-3 w-20 rounded bg-muted"></div>
						</div>
						<div class="h-4 w-20 rounded bg-muted"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Hero Card: Total Balance -->
		<div
			class="rounded-xl border bg-gradient-to-br from-primary/5 via-primary/8 to-[hsl(38,85%,52%)]/5 p-4 md:p-6"
		>
			<div class="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
				<Wallet class="h-4 w-4" />
				<span>Total Saldo</span>
			</div>
			<p class="text-3xl font-bold md:text-4xl">{formatRupiah(dashboard.totalBalance)}</p>
			<p class="mt-2 text-xs text-muted-foreground">
				{dashboard.summary.netWorth >= 0 ? 'Total aset' : 'Total kewajiban'} bersih: {formatRupiah(
					Math.abs(dashboard.summary.netWorth)
				)}
			</p>
		</div>

		<!-- Period Toggle -->
		{@const periods: Array<{ value: 'daily' | 'weekly' | 'monthly'; label: string }> = [
			{ value: 'daily', label: 'Hari Ini' },
			{ value: 'weekly', label: 'Minggu Ini' },
			{ value: 'monthly', label: 'Bulan Ini' }
		]}
		<div class="flex justify-center">
			<div class="inline-flex rounded-xl bg-muted p-1">
				{#each periods as period (period.value)}
					<button
						onclick={() => changePeriod(period.value)}
						class="min-h-[48px] rounded-lg px-4 py-3 text-base font-medium transition-[background-color,color,box-shadow] {selectedPeriod ===
						period.value
							? 'bg-card shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						{period.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Loading indicator when changing period -->
		{#if loading}
			<div class="flex justify-center py-2">
				<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		{/if}

		<!-- Summary Cards -->
		<div class="grid gap-4 md:grid-cols-3">
			<!-- Pemasukan -->
			<div class="rounded-xl border bg-card p-4">
				<div class="mb-1 flex items-center gap-2 text-sm text-green-600">
					<TrendingUp class="h-4 w-4" />
					<span>Pemasukan</span>
				</div>
				<p class="text-xl font-semibold text-green-600 md:text-2xl">
					{formatRupiah(dashboard.period.income)}
				</p>
			</div>

			<!-- Pengeluaran -->
			<div class="rounded-xl border bg-card p-4">
				<div class="mb-1 flex items-center gap-2 text-sm text-red-600">
					<TrendingDown class="h-4 w-4" />
					<span>Pengeluaran</span>
				</div>
				<p class="text-xl font-semibold text-red-600 md:text-2xl">
					{formatRupiah(dashboard.period.expense)}
				</p>
			</div>

			<!-- Laba/Rugi -->
			<a
				href="/laporan/laba-rugi"
				class="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
			>
				<div
					class="mb-1 flex items-center gap-2 text-sm {dashboard.period.profit >= 0
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{#if dashboard.period.profit >= 0}
						<TrendingUp class="h-4 w-4" />
						<span>Laba</span>
					{:else}
						<TrendingDown class="h-4 w-4" />
						<span>Rugi</span>
					{/if}
				</div>
				<p
					class="text-xl font-semibold md:text-2xl {dashboard.period.profit >= 0
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{formatRupiah(Math.abs(dashboard.period.profit))}
				</p>
				<p class="mt-1 text-xs text-muted-foreground">Lihat detail</p>
			</a>
		</div>

		<!-- Cash Flow Chart -->
		{#if dashboard.chartData && dashboard.chartData.length > 0}
			<div class="rounded-xl border bg-card p-4">
				<h2 class="mb-4 text-sm font-medium">Tren Arus Kas (6 Bulan Terakhir)</h2>
				<CashFlowChart data={dashboard.chartData} height={250} />
			</div>
		{:else}
			<!-- Empty Chart State -->
			<div class="rounded-xl border bg-card p-8 text-center">
				<p class="text-sm text-muted-foreground">Belum ada data arus kas untuk ditampilkan</p>
			</div>
		{/if}

		<!-- Tax Status Widget -->
		<div class="rounded-xl border bg-card p-4">
			<h2 class="mb-3 text-sm font-medium">Status Pajak (PPh Final 0.5%)</h2>

			{#if dashboard.annualRevenue >= dashboard.taxThreshold}
				<!-- Amount Due (for high revenue) -->
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Pajak bulan ini:</span>
						<span class="font-medium">{formatRupiah(dashboard.currentMonthTax)}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Omzet bulan ini:</span>
						<span class="font-medium">{formatRupiah(dashboard.currentMonthRevenue)}</span>
					</div>
					<div class="border-t pt-2">
						<p class="text-xs text-muted-foreground">
							Anda telah melampaui batas threshold WP OP ({formatRupiah(dashboard.taxThreshold)})
						</p>
					</div>
				</div>
			{:else}
				<!-- Progress Bar (for low revenue) -->
				<div class="space-y-2">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Omzet tahun ini:</span>
						<span class="font-medium">{formatRupiah(dashboard.annualRevenue)}</span>
					</div>
					<div class="relative h-3 overflow-hidden rounded-full bg-muted">
						<div
							class="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
							style="width: {getTaxProgress(dashboard.annualRevenue, dashboard.taxThreshold)}%"
						></div>
					</div>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>0</span>
						<span>{formatRupiah(dashboard.taxThreshold)}</span>
					</div>
					<p class="pt-1 text-xs text-muted-foreground">
						Progress threshold WP OP: {getTaxProgress(
							dashboard.annualRevenue,
							dashboard.taxThreshold
						).toFixed(1)}%
					</p>
				</div>
			{/if}
		</div>

		<!-- Piutang/Hutang Summary -->
		<div class="grid gap-4 md:grid-cols-2">
			<!-- Piutang -->
			<a
				href="/hutang-piutang?type=piutang"
				class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
			>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Piutang</span>
					<ArrowUpRight class="h-4 w-4 text-muted-foreground" />
				</div>
				<p class="text-xl font-semibold text-green-600">{formatRupiah(dashboard.debts.piutang)}</p>
				<p class="mt-1 text-xs text-muted-foreground">Total piutang aktif</p>
			</a>

			<!-- Hutang -->
			<a
				href="/hutang-piutang?type=hutang"
				class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
			>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-muted-foreground">Hutang</span>
					<ArrowDownRight class="h-4 w-4 text-muted-foreground" />
				</div>
				<p class="text-xl font-semibold text-red-600">{formatRupiah(dashboard.debts.hutang)}</p>
				<p class="mt-1 text-xs text-muted-foreground">Total hutang aktif</p>
			</a>
		</div>

		<!-- Recent Transactions -->
		<div class="overflow-hidden rounded-xl border bg-card">
			<div class="flex items-center justify-between border-b p-4">
				<h2 class="font-medium">Transaksi Terbaru</h2>
				<a href="/transaksi" class="flex items-center gap-1 text-sm text-primary hover:underline">
					Lihat semua
					<ChevronRight class="h-4 w-4" />
				</a>
			</div>

			{#if dashboard.recentTransactions && dashboard.recentTransactions.length > 0}
				<div class="divide-y">
					{#each dashboard.recentTransactions as transaction (transaction.id)}
						{@const TransactionIcon = getTransactionIcon(transaction.type)}
						<a
							href="/transaksi/{transaction.id}"
							class="flex items-center gap-4 p-4 transition-colors hover:bg-accent/50"
						>
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full {transaction.type ===
								'income'
									? 'bg-green-100'
									: 'bg-red-100'}"
							>
								<TransactionIcon
									class="h-5 w-5 {transaction.type === 'income'
										? 'text-green-600'
										: 'text-red-600'}"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{transaction.description}</p>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<span>{transaction.accountName}</span>
									{#if transaction.categoryName}
										<span>·</span>
										<span>{transaction.categoryName}</span>
									{/if}
								</div>
							</div>
							<div class="text-right">
								<p
									class="font-medium {transaction.type === 'income'
										? 'text-green-600'
										: 'text-red-600'}"
								>
									{transaction.type === 'income' ? '+' : '-'}{formatRupiah(transaction.amount)}
								</p>
								<p class="flex items-center justify-end gap-1 text-xs text-muted-foreground">
									<Clock class="h-3 w-3" />
									{formatDateSlash(transaction.date)}
								</p>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<!-- Empty State -->
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
						<Receipt class="h-8 w-8 text-muted-foreground" />
					</div>
					<h2 class="mb-2 text-lg font-medium">Selamat datang!</h2>
					<p class="mb-6 max-w-sm text-sm text-muted-foreground">
						Yuk, catat transaksi pertamamu untuk memulai keuangan yang lebih tertata!
					</p>
					<a
						href="/transaksi/tambah"
						class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						<Plus class="h-4 w-4" />
						Tambah Transaksi
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>

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
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let loading = $state(false);
	let selectedPeriod = $state<'daily' | 'weekly' | 'monthly'>('monthly');

	// Derived
	let dashboard = $derived(data.dashboard);
	let hasError = $derived(!dashboard && data.error);

	// Format currency to Indonesian Rupiah
	function formatRupiah(amount: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}

	// Format date to DD/MM/YYYY
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('id-ID', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		}).format(date);
	}

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

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Beranda</h1>
		<p class="text-sm text-muted-foreground">Ringkasan keuangan bisnis Anda</p>
	</div>

	{#if hasError}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
				<Receipt class="w-8 h-8 text-destructive" />
			</div>
			<h3 class="text-lg font-medium mb-2">Gagal memuat data</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				{data.error || 'Terjadi kesalahan saat memuat data dashboard'}
			</p>
			<button
				onclick={() => goto('/beranda')}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				Coba Lagi
			</button>
		</div>
	{:else if !dashboard}
		<!-- Skeleton Loading State -->
		<div class="space-y-6 animate-pulse">
			<!-- Hero Card Skeleton -->
			<div class="bg-primary/5 border rounded-lg p-6">
				<div class="h-4 w-24 bg-muted rounded mb-2"></div>
				<div class="h-10 w-48 bg-muted rounded"></div>
			</div>

			<!-- Summary Cards Skeleton -->
			<div class="grid gap-4 md:grid-cols-3">
				{#each [1, 2, 3] as i (i)}
					<div class="bg-card border rounded-lg p-4">
						<div class="h-4 w-16 bg-muted rounded mb-2"></div>
						<div class="h-8 w-32 bg-muted rounded"></div>
					</div>
				{/each}
			</div>

			<!-- Chart Skeleton -->
			<div class="bg-card border rounded-lg p-4 h-64">
				<div class="h-4 w-32 bg-muted rounded mb-4"></div>
				<div class="flex items-end justify-around h-40 gap-2">
					{#each [1, 2, 3, 4, 5, 6] as i (i)}
						<div class="flex-1 bg-muted rounded-t"></div>
					{/each}
				</div>
			</div>

			<!-- Recent Transactions Skeleton -->
			<div class="bg-card border rounded-lg p-4">
				<div class="h-4 w-32 bg-muted rounded mb-4"></div>
				{#each [1, 2, 3] as i (i)}
					<div class="flex items-center gap-4 py-3 border-b last:border-0">
						<div class="w-10 h-10 bg-muted rounded-full"></div>
						<div class="flex-1">
							<div class="h-4 w-32 bg-muted rounded mb-1"></div>
							<div class="h-3 w-20 bg-muted rounded"></div>
						</div>
						<div class="h-4 w-20 bg-muted rounded"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Hero Card: Total Balance -->
		<div class="bg-primary/5 border rounded-lg p-4 md:p-6">
			<div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
				<Wallet class="w-4 h-4" />
				<span>Total Saldo</span>
			</div>
			<p class="text-3xl md:text-4xl font-bold">{formatRupiah(dashboard.totalBalance)}</p>
			<p class="text-xs text-muted-foreground mt-2">
				{dashboard.summary.netWorth >= 0 ? 'Total aset' : 'Total kewajiban'} bersih: {formatRupiah(
					Math.abs(dashboard.summary.netWorth)
				)}
			</p>
		</div>

		<!-- Period Toggle -->
		<div class="flex justify-center">
			<div class="inline-flex bg-muted rounded-lg p-1">
				<button
					onclick={() => changePeriod('daily')}
					class="px-4 py-3 min-h-[48px] text-base font-medium rounded-md transition-all {selectedPeriod ===
					'daily'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Hari Ini
				</button>
				<button
					onclick={() => changePeriod('weekly')}
					class="px-4 py-3 min-h-[48px] text-base font-medium rounded-md transition-all {selectedPeriod ===
					'weekly'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Minggu Ini
				</button>
				<button
					onclick={() => changePeriod('monthly')}
					class="px-4 py-3 min-h-[48px] text-base font-medium rounded-md transition-all {selectedPeriod ===
					'monthly'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Bulan Ini
				</button>
			</div>
		</div>

		<!-- Loading indicator when changing period -->
		{#if loading}
			<div class="flex justify-center py-2">
				<Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		{/if}

		<!-- Summary Cards: Today's/Minggu/Bulan Stats -->
		<div class="grid gap-4 md:grid-cols-3">
			<!-- Pemasukan -->
			<div class="bg-card border rounded-lg p-4">
				<div class="flex items-center gap-2 text-sm text-green-600 mb-1">
					<TrendingUp class="w-4 h-4" />
					<span>Pemasukan</span>
				</div>
				<p class="text-xl md:text-2xl font-semibold text-green-600">
					{formatRupiah(dashboard.period.income)}
				</p>
			</div>

			<!-- Pengeluaran -->
			<div class="bg-card border rounded-lg p-4">
				<div class="flex items-center gap-2 text-sm text-red-600 mb-1">
					<TrendingDown class="w-4 h-4" />
					<span>Pengeluaran</span>
				</div>
				<p class="text-xl md:text-2xl font-semibold text-red-600">
					{formatRupiah(dashboard.period.expense)}
				</p>
			</div>

			<!-- Laba/Rugi -->
			<a
				href="/laporan/laba-rugi"
				class="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors block"
			>
				<div
					class="flex items-center gap-2 text-sm {dashboard.period.profit >= 0
						? 'text-green-600'
						: 'text-red-600'} mb-1"
				>
					{#if dashboard.period.profit >= 0}
						<TrendingUp class="w-4 h-4" />
						<span>Laba</span>
					{:else}
						<TrendingDown class="w-4 h-4" />
						<span>Rugi</span>
					{/if}
				</div>
				<p
					class="text-xl md:text-2xl font-semibold {dashboard.period.profit >= 0
						? 'text-green-600'
						: 'text-red-600'}"
				>
					{formatRupiah(Math.abs(dashboard.period.profit))}
				</p>
				<p class="text-xs text-muted-foreground mt-1">Lihat detail</p>
			</a>
		</div>

		<!-- Cash Flow Chart -->
		{#if dashboard.chartData && dashboard.chartData.length > 0}
			<div class="bg-card border rounded-lg p-4">
				<h3 class="text-sm font-medium mb-4">Tren Arus Kas (6 Bulan Terakhir)</h3>
				<CashFlowChart data={dashboard.chartData} height={250} />
			</div>
		{:else}
			<!-- Empty Chart State -->
			<div class="bg-card border rounded-lg p-8 text-center">
				<p class="text-muted-foreground text-sm">Belum ada data arus kas untuk ditampilkan</p>
			</div>
		{/if}

		<!-- Tax Status Widget -->
		<div class="bg-card border rounded-lg p-4">
			<h3 class="text-sm font-medium mb-3">Status Pajak (PPh Final 0.5%)</h3>

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
					<div class="pt-2 border-t">
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
					<div class="relative h-3 bg-muted rounded-full overflow-hidden">
						<div
							class="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
							style="width: {getTaxProgress(dashboard.annualRevenue, dashboard.taxThreshold)}%"
						></div>
					</div>
					<div class="flex justify-between text-xs text-muted-foreground">
						<span>0</span>
						<span>{formatRupiah(dashboard.taxThreshold)}</span>
					</div>
					<p class="text-xs text-muted-foreground pt-1">
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
				class="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors"
			>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-muted-foreground">Piutang</span>
					<ArrowUpRight class="w-4 h-4 text-muted-foreground" />
				</div>
				<p class="text-xl font-semibold text-green-600">{formatRupiah(dashboard.debts.piutang)}</p>
				<p class="text-xs text-muted-foreground mt-1">Total piutang aktif</p>
			</a>

			<!-- Hutang -->
			<a
				href="/hutang-piutang?type=hutang"
				class="bg-card border rounded-lg p-4 hover:bg-accent/50 transition-colors"
			>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-muted-foreground">Hutang</span>
					<ArrowDownRight class="w-4 h-4 text-muted-foreground" />
				</div>
				<p class="text-xl font-semibold text-red-600">{formatRupiah(dashboard.debts.hutang)}</p>
				<p class="text-xs text-muted-foreground mt-1">Total hutang aktif</p>
			</a>
		</div>

		<!-- Recent Transactions -->
		<div class="bg-card border rounded-lg">
			<div class="flex items-center justify-between p-4 border-b">
				<h3 class="font-medium">Transaksi Terbaru</h3>
				<a href="/transaksi" class="text-sm text-primary hover:underline flex items-center gap-1">
					Lihat semua
					<ChevronRight class="w-4 h-4" />
				</a>
			</div>

			{#if dashboard.recentTransactions && dashboard.recentTransactions.length > 0}
				<div class="divide-y">
					{#each dashboard.recentTransactions as transaction (transaction.id)}
						{@const TransactionIcon = getTransactionIcon(transaction.type)}
						<a
							href="/transaksi/{transaction.id}"
							class="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
						>
							<div
								class="w-10 h-10 rounded-full flex items-center justify-center {transaction.type ===
								'income'
									? 'bg-green-100'
									: 'bg-red-100'}"
							>
								<TransactionIcon
									class="w-5 h-5 {transaction.type === 'income'
										? 'text-green-600'
										: 'text-red-600'}"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-medium truncate">{transaction.description}</p>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<span>{transaction.accountName}</span>
									{#if transaction.categoryName}
										<span>•</span>
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
								<p class="text-xs text-muted-foreground flex items-center gap-1 justify-end">
									<Clock class="w-3 h-3" />
									{formatDate(transaction.date)}
								</p>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<!-- Empty State -->
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
						<Receipt class="w-8 h-8 text-muted-foreground" />
					</div>
					<h3 class="text-lg font-medium mb-2">Selamat datang!</h3>
					<p class="text-sm text-muted-foreground mb-6 max-w-sm">
						Yuk, catat transaksi pertamamu untuk memulai keuangan yang lebih tertata!
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
		</div>
	{/if}
</div>

<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		TrendingUp,
		TrendingDown,
		Wallet,
		ArrowUpRight,
		ArrowDownRight,
		ChevronLeft,
		Receipt
	} from '@lucide/svelte';
	import { formatRupiah, getComparisonText, getMaxCategoryValue } from '$lib/utils';
	import type { PageData } from './$types';

	type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

	let { data }: { data: PageData } = $props();

	// State - initialize from URL param via data
	let loading = $state(false);
	let selectedPeriod = $state<Period>('monthly');

	// Keep selectedPeriod in sync with data after navigation
	$effect(() => {
		if (data.profitLoss?.period) {
			selectedPeriod = data.profitLoss.period as Period;
		}
	});

	// Derived
	let profitLoss = $derived(data.profitLoss);
	let hasError = $derived(!profitLoss && data.error);

	// Get previous period text
	function getPreviousPeriodText(change: number, previousValue: number): string {
		const comparison = getComparisonText(change);
		if (comparison.text === 'Tidak berubah') {
			return 'Tidak ada perubahan dari bulan lalu';
		}
		return `dari bulan lalu (${formatRupiah(previousValue)})`;
	}

	// Handle period change
	async function changePeriod(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly') {
		if (loading || selectedPeriod === period) return;

		loading = true;
		selectedPeriod = period;

		try {
			await goto(`/laporan/laba-rugi?period=${period}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing period:', e);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Laba/Rugi - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a
			href="/beranda"
			class="p-2 hover:bg-accent rounded-lg transition-colors"
			aria-label="Kembali ke beranda"
		>
			<ChevronLeft class="w-5 h-5" />
		</a>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Laporan Laba/Rugi</h1>
			<p class="text-sm text-muted-foreground">Ringkasan pendapatan dan pengeluaran</p>
		</div>
	</div>

	{#if hasError}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
				<Receipt class="w-8 h-8 text-destructive" />
			</div>
			<h3 class="text-lg font-medium mb-2">Gagal memuat data</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				{data.error || 'Terjadi kesalahan saat memuat data laporan'}
			</p>
			<button
				onclick={() => goto('/laporan/laba-rugi')}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				Coba Lagi
			</button>
		</div>
	{:else if !profitLoss}
		<!-- Skeleton Loading State -->
		<div class="space-y-6 animate-pulse">
			<!-- Period Toggle Skeleton -->
			<div class="flex justify-center">
				<div class="inline-flex bg-muted rounded-lg p-1">
					<div class="px-4 py-2 rounded-md bg-muted w-20"></div>
					<div class="px-4 py-2 rounded-md bg-muted w-20"></div>
					<div class="px-4 py-2 rounded-md bg-muted w-20"></div>
					<div class="px-4 py-2 rounded-md bg-muted w-20"></div>
					<div class="px-4 py-2 rounded-md bg-muted w-20"></div>
				</div>
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

			<!-- Charts Skeleton -->
			<div class="grid gap-4 md:grid-cols-2">
				<div class="bg-card border rounded-lg p-4 h-64">
					<div class="h-4 w-32 bg-muted rounded mb-4"></div>
					{#each [1, 2, 3, 4] as i (i)}
						<div class="flex items-center gap-4 mb-3">
							<div class="w-4 h-4 bg-muted rounded"></div>
							<div class="flex-1 h-4 bg-muted rounded"></div>
						</div>
					{/each}
				</div>
				<div class="bg-card border rounded-lg p-4 h-64">
					<div class="h-4 w-32 bg-muted rounded mb-4"></div>
					{#each [1, 2, 3, 4] as i (i)}
						<div class="flex items-center gap-4 mb-3">
							<div class="w-4 h-4 bg-muted rounded"></div>
							<div class="flex-1 h-4 bg-muted rounded"></div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<!-- Period Toggle -->
		<div class="flex justify-center">
			<div class="inline-flex bg-muted rounded-lg p-1">
				<button
					onclick={() => changePeriod('daily')}
					class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedPeriod ===
					'daily'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Hari Ini
				</button>
				<button
					onclick={() => changePeriod('weekly')}
					class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedPeriod ===
					'weekly'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Minggu Ini
				</button>
				<button
					onclick={() => changePeriod('monthly')}
					class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedPeriod ===
					'monthly'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Bulan Ini
				</button>
				<button
					onclick={() => changePeriod('quarterly')}
					class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedPeriod ===
					'quarterly'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Quarter
				</button>
				<button
					onclick={() => changePeriod('yearly')}
					class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedPeriod ===
					'yearly'
						? 'bg-background shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Tahun Ini
				</button>
			</div>
		</div>

		<!-- Content area: dims while loading to avoid layout shift -->
		<div
			class="space-y-6 transition-opacity duration-150 {loading
				? 'opacity-50 pointer-events-none'
				: ''}"
		>
			<!-- Period Label -->
			<div class="text-center">
				<p class="text-sm text-muted-foreground">{profitLoss.periodLabel}</p>
			</div>

			<!-- Hero Card: Total Balance -->
			<div class="bg-primary/5 border rounded-lg p-4 md:p-6">
				<div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
					<Wallet class="w-4 h-4" />
					<span>Total Saldo Saat Ini</span>
				</div>
				<p class="text-3xl md:text-4xl font-bold">{formatRupiah(profitLoss.totalBalance)}</p>
			</div>

			<!-- Summary Cards -->
			<div class="grid gap-4 md:grid-cols-3">
				<!-- Pemasukan -->
				<div class="bg-card border rounded-lg p-4">
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-2 text-sm text-green-600">
							<TrendingUp class="w-4 h-4" />
							<span>Pemasukan</span>
						</div>
						{#if profitLoss.comparison.income.change !== 0}
							{@const comparison = getComparisonText(profitLoss.comparison.income.change)}
							<span
								class="text-xs font-medium {comparison.isPositive
									? 'text-green-600'
									: 'text-red-600'}"
							>
								{comparison.text}
							</span>
						{/if}
					</div>
					<p class="text-xl md:text-2xl font-semibold text-green-600">
						{formatRupiah(profitLoss.income)}
					</p>
					<p class="text-xs text-muted-foreground mt-1">
						{getPreviousPeriodText(
							profitLoss.comparison.income.change,
							profitLoss.comparison.income.previousValue
						)}
					</p>
				</div>

				<!-- Pengeluaran -->
				<div class="bg-card border rounded-lg p-4">
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-2 text-sm text-red-600">
							<TrendingDown class="w-4 h-4" />
							<span>Pengeluaran</span>
						</div>
						{#if profitLoss.comparison.expense.change !== 0}
							{@const comparison = getComparisonText(profitLoss.comparison.expense.change)}
							<span
								class="text-xs font-medium {comparison.isPositive
									? 'text-green-600'
									: 'text-red-600'}"
							>
								{comparison.text}
							</span>
						{/if}
					</div>
					<p class="text-xl md:text-2xl font-semibold text-red-600">
						{formatRupiah(profitLoss.expense)}
					</p>
					<p class="text-xs text-muted-foreground mt-1">
						{getPreviousPeriodText(
							profitLoss.comparison.expense.change,
							profitLoss.comparison.expense.previousValue
						)}
					</p>
				</div>

				<!-- Laba/Rugi -->
				<div class="bg-card border rounded-lg p-4">
					<div class="flex items-center justify-between mb-2">
						<div
							class="flex items-center gap-2 text-sm {profitLoss.profit >= 0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{#if profitLoss.profit >= 0}
								<TrendingUp class="w-4 h-4" />
								<span>Laba</span>
							{:else}
								<TrendingDown class="w-4 h-4" />
								<span>Rugi</span>
							{/if}
						</div>
						{#if profitLoss.comparison.profit.change !== 0}
							{@const comparison = getComparisonText(profitLoss.comparison.profit.change)}
							<span
								class="text-xs font-medium {comparison.isPositive
									? 'text-green-600'
									: 'text-red-600'}"
							>
								{comparison.text}
							</span>
						{/if}
					</div>
					<p
						class="text-xl md:text-2xl font-semibold {profitLoss.profit >= 0
							? 'text-green-600'
							: 'text-red-600'}"
					>
						{formatRupiah(Math.abs(profitLoss.profit))}
					</p>
					<p class="text-xs text-muted-foreground mt-1">
						{getPreviousPeriodText(
							profitLoss.comparison.profit.change,
							profitLoss.comparison.profit.previousValue
						)}
					</p>
				</div>
			</div>

			<!-- Category Breakdown Charts -->
			{#if profitLoss.categoryBreakdown.income.length > 0 || profitLoss.categoryBreakdown.expense.length > 0}
				<div class="grid gap-4 md:grid-cols-2">
					<!-- Pemasukan by Category -->
					<div class="bg-card border rounded-lg p-4">
						<h3 class="text-sm font-medium mb-4 flex items-center gap-2">
							<ArrowUpRight class="w-4 h-4 text-green-600" />
							<span>Pemasukan per Kategori</span>
						</h3>

						{#if profitLoss.categoryBreakdown.income.length > 0}
							{@const maxIncome = getMaxCategoryValue(profitLoss.categoryBreakdown.income)}
							<div class="space-y-3">
								{#each profitLoss.categoryBreakdown.income as category (category.categoryId)}
									<div class="space-y-1">
										<div class="flex items-center justify-between text-sm">
											<span class="font-medium">
												{#if category.categoryCode}
													<span class="text-muted-foreground font-mono text-xs mr-1"
														>{category.categoryCode}</span
													>
												{/if}
												{category.categoryName}
											</span>
											<span class="text-muted-foreground">
												{formatRupiah(category.total)} ({category.percentage.toFixed(1)}%)
											</span>
										</div>
										<div class="h-2 bg-muted rounded-full overflow-hidden">
											<div
												class="h-full bg-green-500 rounded-full transition-all"
												style="width: {(category.total / maxIncome) * 100}%"
											></div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-muted-foreground text-center py-4">Tidak ada data pemasukan</p>
						{/if}
					</div>

					<!-- Pengeluaran by Category -->
					<div class="bg-card border rounded-lg p-4">
						<h3 class="text-sm font-medium mb-4 flex items-center gap-2">
							<ArrowDownRight class="w-4 h-4 text-red-600" />
							<span>Pengeluaran per Kategori</span>
						</h3>

						{#if profitLoss.categoryBreakdown.expense.length > 0}
							{@const maxExpense = getMaxCategoryValue(profitLoss.categoryBreakdown.expense)}
							<div class="space-y-3">
								{#each profitLoss.categoryBreakdown.expense as category (category.categoryId)}
									<div class="space-y-1">
										<div class="flex items-center justify-between text-sm">
											<span class="font-medium">
												{#if category.categoryCode}
													<span class="text-muted-foreground font-mono text-xs mr-1"
														>{category.categoryCode}</span
													>
												{/if}
												{category.categoryName}
											</span>
											<span class="text-muted-foreground">
												{formatRupiah(category.total)} ({category.percentage.toFixed(1)}%)
											</span>
										</div>
										<div class="h-2 bg-muted rounded-full overflow-hidden">
											<div
												class="h-full bg-red-500 rounded-full transition-all"
												style="width: {(category.total / maxExpense) * 100}%"
											></div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-muted-foreground text-center py-4">
								Tidak ada data pengeluaran
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<!-- Empty State -->
				<div class="bg-card border rounded-lg p-8 text-center">
					<div
						class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"
					>
						<Receipt class="w-6 h-6 text-muted-foreground" />
					</div>
					<p class="text-muted-foreground text-sm">Belum ada transaksi untuk periode ini</p>
					<a
						href="/transaksi/tambah"
						class="text-primary text-sm hover:underline mt-2 inline-block"
					>
						Tambah transaksi pertama
					</a>
				</div>
			{/if}

			<!-- Quick Link to Dashboard -->
			<div class="flex justify-center">
				<a href="/beranda" class="text-sm text-primary hover:underline flex items-center gap-1">
					Lihat ringkasan di dashboard
					<ChevronLeft class="w-4 h-4 rotate-180" />
				</a>
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		TrendingUp,
		TrendingDown,
		Wallet,
		ArrowUpRight,
		ArrowDownRight,
		Loader2,
		ChevronLeft,
		FileText,
		Scale,
		CreditCard,
		Calendar,
		Download,
		FileSpreadsheet,
		Printer,
		AlertCircle
	} from '@lucide/svelte';
	import { INDONESIAN_MONTHS } from '$lib/tax/config';
	import type { PageData } from './$types';

	type ReportType = 'laba-rugi' | 'neraca' | 'catatan';
	type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
	type CatatanPeriod = 'monthly' | 'quarterly' | 'yearly';

	let { data }: { data: PageData } = $props();

	// State for UI interactions only
	let loading = $state(false);

	// Use data directly - no need for redundant state
	let selectedReportType = $derived<ReportType>((data.reportType as ReportType) || 'laba-rugi');
	let selectedPeriod = $derived<Period>((data.period as Period) || 'monthly');
	let selectedDate = $derived(data.selectedDate || new Date().toISOString().split('T')[0]);
	let selectedCatatanPeriod = $derived<CatatanPeriod>(
		(data.catatanPeriod as CatatanPeriod) || 'monthly'
	);

	// Derived - use data directly
	let hasError = $derived(!data.profitLoss && !data.balanceSheet && !data.catatan && data.error);

	// Memoized formatter for performance
	const formatRupiah = $derived(
		new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format
	);

	// Format currency using memoized formatter
	function formatRupiahValue(amount: number): string {
		return formatRupiah(amount);
	}

	// Format date to Indonesian format
	function formatDate(dateStr: string): string {
		const [year, month, day] = dateStr.split('-').map(Number);
		const monthName = INDONESIAN_MONTHS[month - 1];
		return `${day} ${monthName} ${year}`;
	}

	// Get comparison text
	function getComparisonText(change: number): { text: string; isPositive: boolean } {
		const absChange = Math.abs(change);
		if (change > 0) return { text: `Naik ${absChange.toFixed(1)}%`, isPositive: true };
		else if (change < 0) return { text: `Turun ${absChange.toFixed(1)}%`, isPositive: false };
		return { text: 'Tidak berubah', isPositive: true };
	}

	// Calculate max for chart scaling
	function getMaxCategoryValue(categories: { total: number }[]): number {
		return Math.max(...categories.map((c) => c.total), 1);
	}

	// Handle report type change
	async function changeReportType(type: ReportType) {
		if (loading || selectedReportType === type) return;
		loading = true;
		try {
			await goto(`/laporan?type=${type}`, { replaceState: true, noScroll: true });
		} catch (e) {
			console.error('Error changing report type:', e);
		} finally {
			loading = false;
		}
	}

	// Handle period change
	async function changePeriod(period: Period) {
		if (loading || selectedPeriod === period) return;
		loading = true;
		try {
			await goto(`/laporan?type=${selectedReportType}&period=${period}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing period:', e);
		} finally {
			loading = false;
		}
	}

	// Handle date change
	async function changeDate() {
		if (loading) return;
		loading = true;
		try {
			await goto(`/laporan?type=${selectedReportType}&date=${selectedDate}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing date:', e);
		} finally {
			loading = false;
		}
	}

	// Handle catatan period change
	async function changeCatatanPeriod(period: CatatanPeriod) {
		if (loading || selectedCatatanPeriod === period) return;
		loading = true;
		try {
			await goto(`/laporan?type=${selectedReportType}&catatanPeriod=${period}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing catatan period:', e);
		} finally {
			loading = false;
		}
	}

	// Print functionality
	function printReport() {
		window.print();
	}

	// Export placeholder (full export will be implemented in FEAT-P3-004/005)
	function exportPDF() {
		alert(
			'Fitur export PDF akan segera tersedia. Gunakan fitur cetak browser (Ctrl+P atau Cmd+P) sebagai alternatif.'
		);
	}

	function exportExcel() {
		alert('Fitur export Excel akan segera tersedia.');
	}
</script>

<svelte:head>
	<title>Laporan - Buku UMKM</title>
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
			<h1 class="text-2xl font-bold tracking-tight">Laporan</h1>
			<p class="text-sm text-muted-foreground">Laporan keuangan usaha</p>
		</div>
	</div>

	{#if hasError}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
				<AlertCircle class="w-8 h-8 text-destructive" />
			</div>
			<h3 class="text-lg font-medium mb-2">Gagal memuat data</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				{data.error || 'Terjadi kesalahan saat memuat data laporan'}
			</p>
			<button
				onclick={() => goto('/laporan')}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				Coba Lagi
			</button>
		</div>
	{:else}
		<!-- Report Type Selector (Tabs) -->
		<div class="flex flex-wrap gap-2 justify-center">
			<button
				onclick={() => changeReportType('laba-rugi')}
				class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
					{selectedReportType === 'laba-rugi'
					? 'bg-primary text-primary-foreground'
					: 'bg-muted hover:bg-muted/80'}"
			>
				<FileText class="w-4 h-4" />
				Laba Rugi
			</button>
			<button
				onclick={() => changeReportType('neraca')}
				class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
					{selectedReportType === 'neraca'
					? 'bg-primary text-primary-foreground'
					: 'bg-muted hover:bg-muted/80'}"
			>
				<Scale class="w-4 h-4" />
				Posisi Keuangan
			</button>
			<button
				onclick={() => changeReportType('catatan')}
				class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
					{selectedReportType === 'catatan'
					? 'bg-primary text-primary-foreground'
					: 'bg-muted hover:bg-muted/80'}"
			>
				<FileText class="w-4 h-4" />
				Catatan
			</button>
		</div>

		<!-- Period Selector based on report type -->
		{#if selectedReportType === 'laba-rugi'}
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
		{:else if selectedReportType === 'neraca'}
			<div class="flex justify-center">
				<div class="flex items-center gap-2 bg-muted rounded-lg p-2">
					<Calendar class="w-4 h-4 text-muted-foreground" />
					<input
						type="date"
						bind:value={selectedDate}
						onchange={changeDate}
						class="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0"
					/>
				</div>
			</div>
		{:else}
			<div class="flex justify-center">
				<div class="inline-flex bg-muted rounded-lg p-1">
					<button
						onclick={() => changeCatatanPeriod('monthly')}
						class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedCatatanPeriod ===
						'monthly'
							? 'bg-background shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						Bulanan
					</button>
					<button
						onclick={() => changeCatatanPeriod('quarterly')}
						class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedCatatanPeriod ===
						'quarterly'
							? 'bg-background shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						Triwulanan
					</button>
					<button
						onclick={() => changeCatatanPeriod('yearly')}
						class="px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all {selectedCatatanPeriod ===
						'yearly'
							? 'bg-background shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						Tahunan
					</button>
				</div>
			</div>
		{/if}

		<!-- Loading indicator -->
		{#if loading}
			<div class="flex justify-center py-2">
				<Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		{/if}

		<!-- Export Buttons -->
		<div class="flex justify-end gap-2 print:hidden">
			<button
				onclick={printReport}
				class="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
			>
				<Printer class="w-4 h-4" />
				Cetak
			</button>
			<button
				onclick={exportPDF}
				class="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
			>
				<Download class="w-4 h-4" />
				Export PDF
			</button>
			<button
				onclick={exportExcel}
				class="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
			>
				<FileSpreadsheet class="w-4 h-4" />
				Export Excel
			</button>
		</div>

		<!-- Report Content -->
		{#if selectedReportType === 'laba-rugi' && data.profitLoss}
			<!-- Period Label -->
			<div class="text-center">
				<p class="text-sm text-muted-foreground">{data.profitLoss.periodLabel}</p>
			</div>

			{#if data.profitLoss.income === 0 && data.profitLoss.expense === 0}
				<!-- Empty State -->
				<div class="bg-card border rounded-lg p-8 text-center">
					<div
						class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"
					>
						<FileText class="w-6 h-6 text-muted-foreground" />
					</div>
					<p class="text-muted-foreground text-sm">Belum ada transaksi untuk periode ini</p>
					<a
						href="/transaksi/tambah"
						class="text-primary text-sm hover:underline mt-2 inline-block"
					>
						Tambah transaksi pertama
					</a>
				</div>
			{:else}
				<!-- Hero Card: Total Balance -->
				<div class="bg-primary/5 border rounded-lg p-4 md:p-6">
					<div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
						<Wallet class="w-4 h-4" />
						<span>Total Saldo Saat Ini</span>
					</div>
					<p class="text-3xl md:text-4xl font-bold">
						{formatRupiahValue(data.profitLoss.totalBalance)}
					</p>
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
							{#if data.profitLoss.comparison.income.change !== 0}
								{@const comparison = getComparisonText(data.profitLoss.comparison.income.change)}
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
							{formatRupiahValue(data.profitLoss.income)}
						</p>
					</div>

					<!-- Pengeluaran -->
					<div class="bg-card border rounded-lg p-4">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2 text-sm text-red-600">
								<TrendingDown class="w-4 h-4" />
								<span>Pengeluaran</span>
							</div>
							{#if data.profitLoss.comparison.expense.change !== 0}
								{@const comparison = getComparisonText(data.profitLoss.comparison.expense.change)}
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
							{formatRupiahValue(data.profitLoss.expense)}
						</p>
					</div>

					<!-- Laba/Rugi -->
					<div class="bg-card border rounded-lg p-4">
						<div class="flex items-center justify-between mb-2">
							<div
								class="flex items-center gap-2 text-sm {data.profitLoss.profit >= 0
									? 'text-green-600'
									: 'text-red-600'}"
							>
								{#if data.profitLoss.profit >= 0}
									<TrendingUp class="w-4 h-4" />
									<span>Laba</span>
								{:else}
									<TrendingDown class="w-4 h-4" />
									<span>Rugi</span>
								{/if}
							</div>
						</div>
						<p
							class="text-xl md:text-2xl font-semibold {data.profitLoss.profit >= 0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{formatRupiahValue(Math.abs(data.profitLoss.profit))}
						</p>
					</div>
				</div>

				<!-- Category Breakdown -->
				{#if data.profitLoss.categoryBreakdown.income.length > 0 || data.profitLoss.categoryBreakdown.expense.length > 0}
					<div class="grid gap-4 md:grid-cols-2">
						<!-- Pemasukan by Category -->
						<div class="bg-card border rounded-lg p-4">
							<h3 class="text-sm font-medium mb-4 flex items-center gap-2">
								<ArrowUpRight class="w-4 h-4 text-green-600" />
								<span>Pemasukan per Kategori</span>
							</h3>

							{#if data.profitLoss.categoryBreakdown.income.length > 0}
								{@const maxIncome = getMaxCategoryValue(data.profitLoss.categoryBreakdown.income)}
								<div class="space-y-3">
									{#each data.profitLoss.categoryBreakdown.income as category (category.categoryId)}
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
													{formatRupiahValue(category.total)} ({category.percentage.toFixed(1)}%)
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
								<p class="text-sm text-muted-foreground text-center py-4">
									Tidak ada data pemasukan
								</p>
							{/if}
						</div>

						<!-- Pengeluaran by Category -->
						<div class="bg-card border rounded-lg p-4">
							<h3 class="text-sm font-medium mb-4 flex items-center gap-2">
								<ArrowDownRight class="w-4 h-4 text-red-600" />
								<span>Pengeluaran per Kategori</span>
							</h3>

							{#if data.profitLoss.categoryBreakdown.expense.length > 0}
								{@const maxExpense = getMaxCategoryValue(data.profitLoss.categoryBreakdown.expense)}
								<div class="space-y-3">
									{#each data.profitLoss.categoryBreakdown.expense as category (category.categoryId)}
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
													{formatRupiahValue(category.total)} ({category.percentage.toFixed(1)}%)
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
				{/if}
			{/if}
		{:else if selectedReportType === 'neraca' && data.balanceSheet}
			<!-- Date Label -->
			<div class="text-center">
				<p class="text-sm text-muted-foreground">Per Tanggal {data.balanceSheet.dateLabel}</p>
			</div>

			{#if data.balanceSheet.assets.total === 0}
				<!-- Empty State -->
				<div class="bg-card border rounded-lg p-8 text-center">
					<div
						class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"
					>
						<Scale class="w-6 h-6 text-muted-foreground" />
					</div>
					<p class="text-muted-foreground text-sm">Belum ada data posisi keuangan</p>
					<a
						href="/transaksi/tambah"
						class="text-primary text-sm hover:underline mt-2 inline-block"
					>
						Tambah transaksi pertama
					</a>
				</div>
			{:else}
				<!-- Balance Sheet -->
				<div class="space-y-4">
					<!-- Assets Section -->
					<div class="bg-card border rounded-lg p-4">
						<div class="flex items-center gap-2 mb-4">
							<Wallet class="w-5 h-5 text-blue-600" />
							<h2 class="text-lg font-semibold">ASET</h2>
							<span class="text-sm text-muted-foreground">(Aktiva)</span>
						</div>

						<div class="space-y-3">
							{#if data.balanceSheet.assets.breakdown.kas.items.length > 0}
								<div class="pl-4 border-l-2 border-blue-200">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.assets.breakdown.kas.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(data.balanceSheet.assets.breakdown.kas.subtotal)}</span
										>
									</div>
									{#each data.balanceSheet.assets.breakdown.kas.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span><span class="font-mono text-xs mr-2">{item.code}</span>{item.name}</span
											>
											<span>{formatRupiahValue(item.balance)}</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if data.balanceSheet.assets.breakdown.bank.items.length > 0}
								<div class="pl-4 border-l-2 border-blue-200">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.assets.breakdown.bank.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(data.balanceSheet.assets.breakdown.bank.subtotal)}</span
										>
									</div>
									{#each data.balanceSheet.assets.breakdown.bank.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span><span class="font-mono text-xs mr-2">{item.code}</span>{item.name}</span
											>
											<span>{formatRupiahValue(item.balance)}</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if data.balanceSheet.assets.breakdown.piutangUsaha.items.length > 0}
								<div class="pl-4 border-l-2 border-blue-200">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.assets.breakdown.piutangUsaha.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(
												data.balanceSheet.assets.breakdown.piutangUsaha.subtotal
											)}</span
										>
									</div>
									{#each data.balanceSheet.assets.breakdown.piutangUsaha.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span><span class="font-mono text-xs mr-2">{item.code}</span>{item.name}</span
											>
											<span>{formatRupiahValue(item.balance)}</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if data.balanceSheet.assets.breakdown.piutangDetail.items.length > 0}
								<div class="pl-4 border-l-2 border-blue-300">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.assets.breakdown.piutangDetail.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(
												data.balanceSheet.assets.breakdown.piutangDetail.subtotal
											)}</span
										>
									</div>
									{#each data.balanceSheet.assets.breakdown.piutangDetail.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span>{item.name}</span>
											<span>{formatRupiahValue(item.remainingAmount)}</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if data.balanceSheet.assets.breakdown.persediaan.items.length > 0}
								<div class="pl-4 border-l-2 border-blue-200">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.assets.breakdown.persediaan.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(
												data.balanceSheet.assets.breakdown.persediaan.subtotal
											)}</span
										>
									</div>
									{#each data.balanceSheet.assets.breakdown.persediaan.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span><span class="font-mono text-xs mr-2">{item.code}</span>{item.name}</span
											>
											<span>{formatRupiahValue(item.balance)}</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if data.balanceSheet.assets.breakdown.aktivaTetap.items.length > 0}
								<div class="pl-4 border-l-2 border-blue-200">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.assets.breakdown.aktivaTetap.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(
												data.balanceSheet.assets.breakdown.aktivaTetap.subtotal
											)}</span
										>
									</div>
									{#each data.balanceSheet.assets.breakdown.aktivaTetap.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span><span class="font-mono text-xs mr-2">{item.code}</span>{item.name}</span
											>
											<span>{formatRupiahValue(item.balance)}</span>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Total Assets -->
							<div class="border-t pt-3 mt-3">
								<div class="flex justify-between items-center font-semibold">
									<span>TOTAL ASET</span>
									<span class="text-lg">{formatRupiahValue(data.balanceSheet.assets.total)}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Liabilities Section -->
					<div class="bg-card border rounded-lg p-4">
						<div class="flex items-center gap-2 mb-4">
							<CreditCard class="w-5 h-5 text-red-600" />
							<h2 class="text-lg font-semibold">KEWAJIBAN</h2>
							<span class="text-sm text-muted-foreground">(Liabilities)</span>
						</div>

						<div class="space-y-3">
							{#if data.balanceSheet.liabilities.breakdown.hutangDetail.items.length > 0}
								<div class="pl-4 border-l-2 border-red-200">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium text-sm"
											>{data.balanceSheet.liabilities.breakdown.hutangDetail.label}</span
										>
										<span class="text-sm font-semibold"
											>{formatRupiahValue(
												data.balanceSheet.liabilities.breakdown.hutangDetail.subtotal
											)}</span
										>
									</div>
									{#each data.balanceSheet.liabilities.breakdown.hutangDetail.items as item (item.id)}
										<div class="flex justify-between text-sm text-muted-foreground pl-2">
											<span>{item.name}</span>
											<span>{formatRupiahValue(item.remainingAmount)}</span>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-muted-foreground pl-4">Tidak ada kewajiban</p>
							{/if}

							<div class="border-t pt-3 mt-3">
								<div class="flex justify-between items-center font-semibold">
									<span>TOTAL KEWAJIBAN</span>
									<span class="text-lg"
										>{formatRupiahValue(data.balanceSheet.liabilities.total)}</span
									>
								</div>
							</div>
						</div>
					</div>

					<!-- Equity Section -->
					<div class="bg-card border rounded-lg p-4">
						<div class="flex items-center gap-2 mb-4">
							<TrendingUp class="w-5 h-5 text-green-600" />
							<h2 class="text-lg font-semibold">EKUITAS</h2>
							<span class="text-sm text-muted-foreground">(Equity)</span>
						</div>

						<div class="space-y-3">
							{#each data.balanceSheet.equity.components as component (component.name)}
								<div class="flex justify-between text-sm">
									<span>{component.name}</span>
									<span>{formatRupiahValue(component.amount)}</span>
								</div>
							{/each}

							<div class="border-t pt-3 mt-3">
								<div class="flex justify-between items-center font-semibold">
									<span>TOTAL EKUITAS</span>
									<span class="text-lg">{formatRupiahValue(data.balanceSheet.equity.total)}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Balance Sheet Equation Validation -->
					<div class="bg-muted/50 border rounded-lg p-4">
						<div class="flex items-center gap-2 mb-3">
							<Scale class="w-5 h-5" />
							<h3 class="font-medium">Validasi Neraca</h3>
						</div>

						<div class="text-sm space-y-2">
							<div class="flex justify-between">
								<span class="text-muted-foreground">Total Aset</span>
								<span class="font-medium"
									>{formatRupiahValue(data.balanceSheet.equation.assets)}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Total Kewajiban + Ekuitas</span>
								<span class="font-medium"
									>{formatRupiahValue(data.balanceSheet.equation.expected)}</span
								>
							</div>
							<div class="border-t pt-2 mt-2">
								<div class="flex justify-between font-semibold">
									<span>Selisih</span>
									<span class={data.balanceSheet.isBalanced ? 'text-green-600' : 'text-red-600'}>
										{formatRupiahValue(
											Math.abs(
												data.balanceSheet.equation.result - data.balanceSheet.equation.expected
											)
										)}
									</span>
								</div>
							</div>
						</div>

						{#if data.balanceSheet.isBalanced}
							<div
								class="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 text-center"
							>
								Neraca seimbang (Aset = Kewajiban + Ekuitas)
							</div>
						{:else}
							<div
								class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 text-center"
							>
								Neraca tidak seimbang - periksa kembali data
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{:else if selectedReportType === 'catatan' && data.catatan}
			<!-- Period Label -->
			<div class="text-center">
				<p class="text-sm text-muted-foreground">Periode: {data.catatan.periodLabel}</p>
			</div>

			{#if !data.catatan.businessProfile}
				<!-- Empty State -->
				<div class="bg-card border rounded-lg p-8 text-center">
					<div
						class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"
					>
						<FileText class="w-6 h-6 text-muted-foreground" />
					</div>
					<p class="text-muted-foreground text-sm">
						Silakan lengkapi profil usaha Anda terlebih dahulu
					</p>
					<a href="/pengaturan" class="text-primary text-sm hover:underline mt-2 inline-block">
						Pengaturan Usaha
					</a>
				</div>
			{:else}
				<!-- Catatan Report -->
				<div
					class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 print:shadow-none print:border-none print:p-0"
				>
					<!-- Report Header -->
					<div class="text-center mb-6">
						<h2 class="text-lg font-semibold">CATATAN ATAS LAPORAN KEUANGAN</h2>
						<p class="text-sm text-muted-foreground mt-1">Notes to Financial Statements</p>
						<div class="mt-4 pt-4 border-t">
							<h3 class="text-xl font-bold">
								{data.catatan.businessProfile.name || '[Nama Usaha]'}
							</h3>
							<p class="text-sm text-muted-foreground mt-1">Periode: {data.catatan.periodLabel}</p>
							<p class="text-xs text-muted-foreground mt-1">
								({formatDate(data.catatan.startDate)} - {formatDate(data.catatan.endDate)})
							</p>
						</div>
					</div>

					<!-- Business Profile Info -->
					{#if data.catatan.businessProfile}
						<div class="mb-4 p-3 bg-muted/50 rounded-lg">
							<h4 class="font-semibold text-sm mb-2">Informasi Usaha</h4>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
								{#if data.catatan.businessProfile.address}
									<div>
										<span class="text-muted-foreground">Alamat:</span>
										{data.catatan.businessProfile.address}
									</div>
								{/if}
								{#if data.catatan.businessProfile.phone}
									<div>
										<span class="text-muted-foreground">Telepon:</span>
										{data.catatan.businessProfile.phone}
									</div>
								{/if}
								{#if data.catatan.businessProfile.npwp}
									<div>
										<span class="text-muted-foreground">NPWP:</span>
										{data.catatan.businessProfile.npwp}
									</div>
								{/if}
								{#if data.catatan.businessProfile.ownerName}
									<div>
										<span class="text-muted-foreground">Pemilik:</span>
										{data.catatan.businessProfile.ownerName}
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Accounting Policies -->
					<div
						class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
					>
						<h4 class="font-semibold text-sm mb-2">Kebijakan Akuntansi / Accounting Policies</h4>
						<div class="space-y-1 text-xs">
							<div>
								<span class="text-blue-700">Dasar Akuntansi:</span>
								{data.catatan.accountingPolicies.basisAccounting}
							</div>
							<div>
								<span class="text-blue-700">Kerangka Akuntansi:</span>
								{data.catatan.accountingPolicies.framework}
							</div>
							<div>
								<span class="text-blue-700">Mata Uang:</span>
								{data.catatan.accountingPolicies.currency}
							</div>
						</div>
					</div>

					<!-- Notes Sections -->
					<div class="space-y-4">
						{#each data.catatan.notesSections as section (section.title)}
							<div>
								<h4 class="font-semibold text-sm mb-1">{section.title}</h4>
								<p class="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
									{section.content}
								</p>
							</div>
						{/each}
					</div>

					<!-- Footer -->
					<div class="mt-6 pt-4 border-t">
						<p class="text-xs text-muted-foreground text-center">
							Dokumen ini dihasilkan secara otomatis oleh Buku UMKM
						</p>
						<p class="text-xs text-muted-foreground text-center mt-1">
							Tanggal cetak: {formatDate(new Date().toISOString().split('T')[0])}
						</p>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Quick Link to Dashboard -->
		<div class="flex justify-center print:hidden">
			<a href="/beranda" class="text-sm text-primary hover:underline flex items-center gap-1">
				Lihat ringkasan di dashboard
				<ChevronLeft class="w-4 h-4 rotate-180" />
			</a>
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
	}
</style>

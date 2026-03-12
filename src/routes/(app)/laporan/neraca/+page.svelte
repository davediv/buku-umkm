<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ChevronLeft,
		Scale,
		Calendar,
		Wallet,
		CreditCard,
		TrendingUp,
		AlertCircle,
		Loader2
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let loading = $state(false);
	let selectedDate = $state(data.balanceSheet?.date ?? new Date().toISOString().split('T')[0]);

	// Keep selectedDate in sync with data after navigation
	$effect(() => {
		if (data.balanceSheet?.date) {
			selectedDate = data.balanceSheet.date;
		}
	});

	// Derived - directly use data since it's already reactive
	let hasError = $derived(!data.balanceSheet && data.error);

	// Format currency to Indonesian Rupiah
	function formatRupiah(amount: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}

	// Handle date change
	async function changeDate() {
		if (loading) return;

		loading = true;

		try {
			await goto(`/laporan/neraca?date=${selectedDate}`, {
				replaceState: true,
				noScroll: true
			});
		} catch (e) {
			console.error('Error changing date:', e);
		} finally {
			loading = false;
		}
	}

	// Handle date input change
	function handleDateInput(event: Event) {
		const target = event.target as HTMLInputElement;
		selectedDate = target.value;
		// Automatically submit on date change
		changeDate();
	}
</script>

<svelte:head>
	<title>Posisi Keuangan - Buku UMKM</title>
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
			<h1 class="text-2xl font-bold tracking-tight">Laporan Posisi Keuangan</h1>
			<p class="text-sm text-muted-foreground">Neraca akuntansi per tanggal</p>
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
				onclick={() => goto('/laporan/neraca')}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				Coba Lagi
			</button>
		</div>
	{:else if !data.balanceSheet}
		<!-- Skeleton Loading State -->
		<div class="space-y-6 animate-pulse">
			<!-- Date Picker Skeleton -->
			<div class="flex justify-center">
				<div class="bg-muted rounded-lg p-2">
					<div class="h-10 w-48 bg-muted rounded"></div>
				</div>
			</div>

			<!-- Balance Sheet Cards Skeleton -->
			<div class="space-y-4">
				{#each [1, 2, 3] as section (section)}
					<div class="bg-card border rounded-lg p-4">
						<div class="h-6 w-32 bg-muted rounded mb-4"></div>
						<div class="space-y-2">
							{#each [1, 2, 3] as item (item)}
								<div class="flex justify-between">
									<div class="h-4 w-24 bg-muted rounded"></div>
									<div class="h-4 w-20 bg-muted rounded"></div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Date Picker -->
		<div class="flex justify-center">
			<div class="flex items-center gap-2 bg-muted rounded-lg p-2">
				<Calendar class="w-4 h-4 text-muted-foreground" />
				<input
					type="date"
					bind:value={selectedDate}
					onchange={handleDateInput}
					class="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0"
				/>
			</div>
		</div>

		<!-- Loading indicator when changing date -->
		{#if loading}
			<div class="flex justify-center py-2">
				<Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		{/if}

		<!-- Date Label -->
		<div class="text-center">
			<p class="text-sm text-muted-foreground">Per Tanggal {data.balanceSheet.dateLabel}</p>
		</div>

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
					<!-- Kas -->
					{#if data.balanceSheet.assets.breakdown.kas.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.kas.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.kas.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.kas.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>
										<span class="font-mono text-xs mr-2">{item.code}</span>
										{item.name}
									</span>
									<span>{formatRupiah(item.balance)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Bank -->
					{#if data.balanceSheet.assets.breakdown.bank.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.bank.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.bank.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.bank.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>
										<span class="font-mono text-xs mr-2">{item.code}</span>
										{item.name}
									</span>
									<span>{formatRupiah(item.balance)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Piutang Usaha (from accounts) -->
					{#if data.balanceSheet.assets.breakdown.piutangUsaha.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.piutangUsaha.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.piutangUsaha.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.piutangUsaha.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>
										<span class="font-mono text-xs mr-2">{item.code}</span>
										{item.name}
									</span>
									<span>{formatRupiah(item.balance)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Piutang (Detail from debt table) -->
					{#if data.balanceSheet.assets.breakdown.piutangDetail.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-300">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.piutangDetail.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.piutangDetail.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.piutangDetail.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>{item.name}</span>
									<span>{formatRupiah(item.remainingAmount)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Persediaan -->
					{#if data.balanceSheet.assets.breakdown.persediaan.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.persediaan.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.persediaan.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.persediaan.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>
										<span class="font-mono text-xs mr-2">{item.code}</span>
										{item.name}
									</span>
									<span>{formatRupiah(item.balance)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Aktiva Tetap -->
					{#if data.balanceSheet.assets.breakdown.aktivaTetap.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.aktivaTetap.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.aktivaTetap.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.aktivaTetap.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>
										<span class="font-mono text-xs mr-2">{item.code}</span>
										{item.name}
									</span>
									<span>{formatRupiah(item.balance)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Lainnya -->
					{#if data.balanceSheet.assets.breakdown.lainnya.items.length > 0}
						<div class="pl-4 border-l-2 border-blue-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.assets.breakdown.lainnya.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.assets.breakdown.lainnya.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.assets.breakdown.lainnya.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>
										<span class="font-mono text-xs mr-2">{item.code}</span>
										{item.name}
									</span>
									<span>{formatRupiah(item.balance)}</span>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Total Assets -->
					<div class="border-t pt-3 mt-3">
						<div class="flex justify-between items-center font-semibold">
							<span>TOTAL ASET</span>
							<span class="text-lg">{formatRupiah(data.balanceSheet.assets.total)}</span>
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
					<!-- Hutang (Detail from debt table) -->
					{#if data.balanceSheet.liabilities.breakdown.hutangDetail.items.length > 0}
						<div class="pl-4 border-l-2 border-red-200">
							<div class="flex justify-between items-center mb-2">
								<span class="font-medium text-sm"
									>{data.balanceSheet.liabilities.breakdown.hutangDetail.label}</span
								>
								<span class="text-sm font-semibold">
									{formatRupiah(data.balanceSheet.liabilities.breakdown.hutangDetail.subtotal)}
								</span>
							</div>
							{#each data.balanceSheet.liabilities.breakdown.hutangDetail.items as item (item.id)}
								<div class="flex justify-between text-sm text-muted-foreground pl-2">
									<span>{item.name}</span>
									<span>{formatRupiah(item.remainingAmount)}</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground pl-4">Tidak ada kewajiban</p>
					{/if}

					<!-- Total Liabilities -->
					<div class="border-t pt-3 mt-3">
						<div class="flex justify-between items-center font-semibold">
							<span>TOTAL KEWAJIBAN</span>
							<span class="text-lg">{formatRupiah(data.balanceSheet.liabilities.total)}</span>
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
							<span>{formatRupiah(component.amount)}</span>
						</div>
					{/each}

					<!-- Total Equity -->
					<div class="border-t pt-3 mt-3">
						<div class="flex justify-between items-center font-semibold">
							<span>TOTAL EKUITAS</span>
							<span class="text-lg">{formatRupiah(data.balanceSheet.equity.total)}</span>
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
						<span class="font-medium">{formatRupiah(data.balanceSheet.equation.assets)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Total Kewajiban + Ekuitas</span>
						<span class="font-medium">{formatRupiah(data.balanceSheet.equation.expected)}</span>
					</div>
					<div class="border-t pt-2 mt-2">
						<div class="flex justify-between font-semibold">
							<span>Selisih</span>
							<span class={data.balanceSheet.isBalanced ? 'text-green-600' : 'text-red-600'}>
								{formatRupiah(
									Math.abs(data.balanceSheet.equation.result - data.balanceSheet.equation.expected)
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

		<!-- Quick Link to Dashboard -->
		<div class="flex justify-center">
			<a href="/beranda" class="text-sm text-primary hover:underline flex items-center gap-1">
				Lihat ringkasan di dashboard
				<ChevronLeft class="w-4 h-4 rotate-180" />
			</a>
		</div>
	{/if}
</div>

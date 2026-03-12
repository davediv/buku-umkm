<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Plus,
		X,
		Search,
		ArrowUpFromLine,
		ArrowDownToLine,
		ChevronRight,
		FileText,
		AlertCircle
	} from '@lucide/svelte';

	let { data } = $props();

	// State
	let activeTab = $state<'piutang' | 'hutang'>('piutang');
	let searchQuery = $state('');
	let showModal = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	// Form state
	let contactName = $state('');
	let contactPhone = $state('');
	let contactAddress = $state('');
	let amount = $state<number | string>('');
	let date = $state(new Date().toISOString().split('T')[0]);
	let dueDate = $state('');
	let description = $state('');

	// Parse initial type from URL
	$effect(() => {
		const typeParam = $page.url.searchParams.get('type');
		if (typeParam === 'piutang' || typeParam === 'hutang') {
			activeTab = typeParam;
		}
	});

	// Derived
	let filteredDebts = $derived(
		data.debts
			.filter((d) => d.type === activeTab)
			.filter((d) => d.contactName.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	let summary = $derived(data.summary);

	// Format currency
	function formatRupiah(value: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	}

	// Format date
	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// Get status badge
	function getStatusBadge(status: string) {
		switch (status) {
			case 'active':
				return { label: 'Aktif', class: 'bg-blue-100 text-blue-700' };
			case 'paid':
				return { label: 'Lunas', class: 'bg-green-100 text-green-700' };
			case 'overdue':
				return { label: 'Jatuh Tempo', class: 'bg-red-100 text-red-700' };
			default:
				return { label: status, class: 'bg-gray-100 text-gray-700' };
		}
	}

	// Open create modal
	function openCreateModal(type: 'piutang' | 'hutang') {
		// Set activeTab to the type being created
		activeTab = type;
		error = null;
		success = null;
		contactName = '';
		contactPhone = '';
		contactAddress = '';
		amount = '';
		date = new Date().toISOString().split('T')[0];
		dueDate = '';
		description = '';
		showModal = true;
	}

	// Close modal
	function closeModal() {
		showModal = false;
	}

	// Handle submit
	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		success = null;

		try {
			const response = await fetch('/api/debts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: activeTab,
					contact_name: contactName,
					contact_phone: contactPhone || undefined,
					contact_address: contactAddress || undefined,
					amount: Number(amount),
					date,
					due_date: dueDate || undefined,
					description: description || undefined
				})
			});

			const result = (await response.json()) as { error?: string; message?: string };

			if (!response.ok) {
				error = result.error || 'Terjadi kesalahan';
				return;
			}

			success = result.message ?? null;
			closeModal();
			goto('/hutang-piutang?type=' + activeTab, { invalidateAll: true });
		} catch (err) {
			error = 'Terjadi kesalahan server';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	// Navigate to detail
	function viewDetail(debtId: string) {
		goto(`/hutang-piutang/${debtId}`);
	}
</script>

<svelte:head>
	<title>Hutang/Piutang - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Hutang & Piutang</h1>
			<p class="text-sm text-muted-foreground">Kelola catatan hutang dan piutang Anda</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => openCreateModal('piutang')}
				class="inline-flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<ArrowUpFromLine class="w-4 h-4" />
				Tambah Piutang
			</button>
			<button
				onclick={() => openCreateModal('hutang')}
				class="inline-flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<ArrowDownToLine class="w-4 h-4" />
				Tambah Hutang
			</button>
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 gap-4">
		<div
			class="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
			onclick={() => (activeTab = 'piutang')}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && (activeTab = 'piutang')}
		>
			<div class="flex items-center gap-2 mb-1">
				<ArrowUpFromLine class="w-4 h-4 text-green-600" />
				<span class="text-sm text-muted-foreground">Total Piutang</span>
			</div>
			<p class="text-xl font-semibold text-green-600">{formatRupiah(summary.piutang)}</p>
		</div>
		<div
			class="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
			onclick={() => (activeTab = 'hutang')}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && (activeTab = 'hutang')}
		>
			<div class="flex items-center gap-2 mb-1">
				<ArrowDownToLine class="w-4 h-4 text-red-600" />
				<span class="text-sm text-muted-foreground">Total Hutang</span>
			</div>
			<p class="text-xl font-semibold text-red-600">{formatRupiah(summary.hutang)}</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="flex gap-2 border-b">
		<button
			onclick={() => (activeTab = 'piutang')}
			class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors {activeTab === 'piutang'
				? 'border-green-600 text-green-600 font-medium'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<ArrowUpFromLine class="w-4 h-4" />
			Piutang
			<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
				>{data.debts.filter((d) => d.type === 'piutang').length}</span
			>
		</button>
		<button
			onclick={() => (activeTab = 'hutang')}
			class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors {activeTab === 'hutang'
				? 'border-red-600 text-red-600 font-medium'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<ArrowDownToLine class="w-4 h-4" />
			Hutang
			<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
				>{data.debts.filter((d) => d.type === 'hutang').length}</span
			>
		</button>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
		<input
			type="text"
			placeholder="Cari berdasarkan nama kontak..."
			bind:value={searchQuery}
			class="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
	</div>

	<!-- Error/Success Message -->
	{#if error}
		<div
			class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md flex items-center gap-2"
		>
			<AlertCircle class="w-4 h-4" />
			{error}
		</div>
	{/if}
	{#if success}
		<div class="bg-green-500/10 border border-green-500 text-green-500 text-sm p-3 rounded-md">
			{success}
		</div>
	{/if}

	<!-- Data Table -->
	{#if filteredDebts.length > 0}
		<div class="bg-card border rounded-lg overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-muted/50 border-b">
						<tr>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
								>Nama Kontak</th
							>
							<th
								class="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider"
								>Jumlah</th
							>
							<th
								class="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider"
								>Sisa</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
								>Jatuh Tempo</th
							>
							<th
								class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
								>Status</th
							>
							<th
								class="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
								>Aksi</th
							>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each filteredDebts as debt (debt.id)}
							{@const statusBadge = getStatusBadge(debt.status)}
							<tr
								class="hover:bg-muted/30 transition-colors cursor-pointer"
								onclick={() => viewDetail(debt.id)}
								role="button"
								tabindex="0"
								onkeydown={(e) => e.key === 'Enter' && viewDetail(debt.id)}
							>
								<td class="px-4 py-3">
									<div class="font-medium">{debt.contactName}</div>
									{#if debt.contactPhone}
										<div class="text-xs text-muted-foreground">{debt.contactPhone}</div>
									{/if}
								</td>
								<td class="px-4 py-3 text-right font-medium">{formatRupiah(debt.originalAmount)}</td
								>
								<td class="px-4 py-3 text-right">{formatRupiah(debt.remainingAmount)}</td>
								<td class="px-4 py-3 text-left">{formatDate(debt.dueDate)}</td>
								<td class="px-4 py-3 text-center">
									<span
										class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full {statusBadge.class}"
									>
										{statusBadge.label}
									</span>
								</td>
								<td class="px-4 py-3 text-center">
									<button
										onclick={(e) => {
											e.stopPropagation();
											viewDetail(debt.id);
										}}
										class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
										aria-label="Lihat detail"
									>
										<ChevronRight class="w-4 h-4" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
				<FileText class="w-8 h-8 text-muted-foreground" />
			</div>
			<h3 class="text-lg font-medium mb-2">
				{searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada catatan hutang/piutang'}
			</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				{#if searchQuery}
					Coba kata kunci lain atau kosongkan pencarian
				{:else}
					Yuk, catat {activeTab === 'piutang' ? 'piutang' : 'hutang'} pertama Anda!
				{/if}
			</p>
			{#if !searchQuery}
				<button
					onclick={() => openCreateModal(activeTab)}
					class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
				>
					<Plus class="w-4 h-4" />
					Tambah {activeTab === 'piutang' ? 'Piutang' : 'Hutang'}
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Modal for Create -->
{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div
			class="bg-background border rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
		>
			<div class="flex items-center justify-between mb-6">
				<h2 id="modal-title" class="text-lg font-semibold">
					Tambah {activeTab === 'piutang' ? 'Piutang' : 'Hutang'}
				</h2>
				<button
					onclick={closeModal}
					class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-2">
					<label for="contactName" class="text-sm font-medium">Nama Kontak *</label>
					<input
						id="contactName"
						type="text"
						bind:value={contactName}
						placeholder={activeTab === 'piutang' ? 'Contoh: Budi Santoso' : 'Contoh: Toko ABC'}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="contactPhone" class="text-sm font-medium">No. Telepon</label>
					<input
						id="contactPhone"
						type="tel"
						bind:value={contactPhone}
						placeholder="Contoh: 0812-3456-7890"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>

				<div class="space-y-2">
					<label for="contactAddress" class="text-sm font-medium">Alamat</label>
					<input
						id="contactAddress"
						type="text"
						bind:value={contactAddress}
						placeholder="Contoh: Jl. Merdeka No. 10"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>

				<div class="space-y-2">
					<label for="amount" class="text-sm font-medium">Jumlah *</label>
					<input
						id="amount"
						type="number"
						bind:value={amount}
						placeholder="Contoh: 1000000"
						min="1"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="date" class="text-sm font-medium">Tanggal *</label>
					<input
						id="date"
						type="date"
						bind:value={date}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="dueDate" class="text-sm font-medium">Tanggal Jatuh Tempo</label>
					<input
						id="dueDate"
						type="date"
						bind:value={dueDate}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>

				<div class="space-y-2">
					<label for="description" class="text-sm font-medium">Keterangan</label>
					<textarea
						id="description"
						bind:value={description}
						placeholder="Contoh: Pembayaran jasa desain logo"
						rows="3"
						class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
					></textarea>
				</div>

				{#if error}
					<div
						class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md"
					>
						{error}
					</div>
				{/if}

				<div class="flex gap-3 pt-4">
					<button
						type="button"
						onclick={closeModal}
						class="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={loading}
						class="flex-1 px-4 py-2 {activeTab === 'piutang'
							? 'bg-green-600 hover:bg-green-700'
							: 'bg-red-600 hover:bg-red-700'} text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
					>
						{loading ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

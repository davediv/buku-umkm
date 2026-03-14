<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Plus,
		Search,
		ChevronDown,
		Pencil,
		Trash2,
		ChevronLeft,
		ChevronRight,
		Calendar,
		Download,
		FileSpreadsheet,
		FileText
	} from '@lucide/svelte';
	import { formatTransactionAmount } from '$lib/utils';
	import { toast } from '$lib/components/ui/toast';
	import {
		exportTransactions,
		generateExportFilename,
		type ExportFormat,
		type TransactionForExport
	} from '$lib/utils/export';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Get success message from URL
	let showSuccess = $derived($page.url.searchParams.get('success') === 'true');

	// State
	let searchQuery = $state('');
	let currentPage = $state(1);
	let pageSize = $state(10);
	let sortBy = $state<'date' | 'amount'>('date');
	let sortOrder = $state<'asc' | 'desc'>('desc');
	let showDateFilter = $state(false);
	let selectedDateRange = $state<'today' | 'week' | 'month' | 'custom'>('month');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let deletingId = $state<string | null>(null);
	let showDeleteConfirm = $state<string | null>(null);
	let showExportMenu = $state(false);
	let isExporting = $state(false);

	// Get date range based on selection
	function getDateRange(): { start: string; end: string } {
		const today = new Date();
		let start: Date;

		switch (selectedDateRange) {
			case 'today':
				return {
					start: today.toISOString().split('T')[0],
					end: today.toISOString().split('T')[0]
				};
			case 'week':
				start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
				break;
			case 'month':
				start = new Date(today.getFullYear(), today.getMonth(), 1);
				break;
			case 'custom':
				return { start: customStartDate, end: customEndDate };
			default:
				start = new Date(today.getFullYear(), today.getMonth(), 1);
		}

		return {
			start: start.toISOString().split('T')[0],
			end: today.toISOString().split('T')[0]
		};
	}

	// Filter and sort transactions - computed once and cached
	let filteredTransactions = $derived.by(() => {
		let result = [...data.transactions];

		// Search filter (client-side)
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(txn) =>
					txn.description?.toLowerCase().includes(query) ||
					txn.category?.name.toLowerCase().includes(query) ||
					txn.account?.name.toLowerCase().includes(query)
			);
		}

		// Sort
		result.sort((a, b) => {
			if (sortBy === 'date') {
				const dateA = new Date(a.date).getTime();
				const dateB = new Date(b.date).getTime();
				return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
			} else {
				return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
			}
		});

		return result;
	});

	// Paginated transactions - computed from filteredTransactions
	let paginatedTransactions = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredTransactions.slice(start, start + pageSize);
	});

	let totalPages = $derived(Math.ceil(filteredTransactions.length / pageSize));

	// Date range label
	let dateRangeLabel = $derived.by(() => {
		const range = getDateRange();
		if (selectedDateRange === 'custom') {
			return `${formatDateShort(range.start)} - ${formatDateShort(range.end)}`;
		}
		const labels: Record<string, string> = {
			today: 'Hari Ini',
			week: 'Minggu Ini',
			month: 'Bulan Ini'
		};
		return labels[selectedDateRange] || 'Bulan Ini';
	});

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatDateShort(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short'
		});
	}

	function toggleSort(column: 'date' | 'amount') {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'desc';
		}
	}

	async function handleDelete(txnId: string) {
		deletingId = txnId;
		try {
			const response = await fetch(`/api/transactions/${txnId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Refresh data
				goto('/transaksi', { invalidateAll: true });
			} else {
				const result = (await response.json()) as { error?: string };
				alert(result.error || 'Gagal menghapus transaksi');
			}
		} catch (error) {
			console.error('Error deleting transaction:', error);
			alert('Terjadi kesalahan server');
		} finally {
			deletingId = null;
			showDeleteConfirm = null;
		}
	}

	async function handleExport(format: ExportFormat) {
		showExportMenu = false;
		isExporting = true;

		try {
			const range = getDateRange();
			// Use high limit to get all transactions for the date range
			const params = new URLSearchParams({
				start_date: range.start,
				end_date: range.end,
				limit: '10000'
			});

			const response = await fetch(`/api/transactions?${params.toString()}`);

			if (!response.ok) {
				throw new Error('Failed to fetch transactions');
			}

			const result = (await response.json()) as { transactions: TransactionForExport[] };

			if (result.transactions.length === 0) {
				toast.warning('Tidak ada transaksi', 'Tidak ada transaksi untuk periode yang dipilih');
				return;
			}

			const filename = generateExportFilename('transaksi');
			await exportTransactions(result.transactions, format, filename);
			toast.success('Berhasil mengekspor', `File ${filename} telah diunduh`);
		} catch (error) {
			console.error('Error exporting transactions:', error);
			toast.error('Gagal mengekspor', 'Terjadi kesalahan saat mengekspor transaksi');
		} finally {
			isExporting = false;
		}
	}

	// Reset page when search changes
	$effect(() => {
		if (searchQuery) {
			currentPage = 1;
		}
	});

	// Close export menu when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (showExportMenu && !target.closest('.export-menu')) {
			showExportMenu = false;
		}
	}

	$effect(() => {
		if (showExportMenu) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<svelte:head>
	<title>Daftar Transaksi - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-4">
	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Transaksi</h1>
			<p class="text-sm text-muted-foreground">Daftar transaksi pemasukan dan pengeluaran Anda</p>
		</div>
		<div class="flex items-center gap-2">
			<!-- Export Button -->
			<div class="relative">
				<button
					onclick={() => (showExportMenu = !showExportMenu)}
					disabled={isExporting}
					class="inline-flex items-center justify-center gap-2 border border-input bg-background hover:bg-secondary px-4 py-3 min-h-[48px] text-base rounded-md font-medium transition-colors disabled:opacity-50"
				>
					{#if isExporting}
						<span
							class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
						></span>
					{:else}
						<Download class="w-4 h-4" />
					{/if}
					{isExporting ? 'Mengekspor...' : 'Ekspor'}
				</button>

				{#if showExportMenu}
					<div
						class="export-menu absolute top-full right-0 mt-2 z-10 bg-background border rounded-lg shadow-lg p-2 min-w-[180px]"
					>
						<button
							onclick={() => handleExport('xlsx')}
							class="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-muted text-left text-sm"
						>
							<FileSpreadsheet class="w-4 h-4 text-green-600" />
							Ekspor Excel (.xlsx)
						</button>
						<button
							onclick={() => handleExport('csv')}
							class="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-muted text-left text-sm"
						>
							<FileText class="w-4 h-4 text-blue-600" />
							Ekspor CSV (.csv)
						</button>
					</div>
				{/if}
			</div>
			<a
				href="/transaksi/tambah"
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-3 min-h-[48px] text-base rounded-md font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Tambah Transaksi
			</a>
		</div>
	</div>

	<!-- Success Message -->
	{#if showSuccess}
		<div class="bg-green-500/10 border border-green-500 text-green-500 text-sm p-3 rounded-md">
			Transaksi berhasil disimpan!
		</div>
	{/if}

	<!-- Search and Filters -->
	<div class="flex flex-col sm:flex-row gap-3">
		<!-- Search -->
		<div class="relative flex-1">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
			<input
				type="text"
				placeholder="Cari transaksi..."
				bind:value={searchQuery}
				class="w-full pl-10 pr-4 py-2 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
			/>
		</div>

		<!-- Date Range Filter -->
		<div class="relative">
			<button
				onclick={() => (showDateFilter = !showDateFilter)}
				class="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-secondary transition-colors"
			>
				<Calendar class="w-4 h-4" />
				<span class="text-sm">{dateRangeLabel}</span>
				<ChevronDown class="w-4 h-4" />
			</button>

			{#if showDateFilter}
				<div
					class="absolute top-full right-0 mt-2 z-10 bg-background border rounded-lg shadow-lg p-3 min-w-[200px]"
				>
					<div class="space-y-2">
						<button
							onclick={() => {
								selectedDateRange = 'today';
								showDateFilter = false;
							}}
							class="w-full text-left px-3 py-2 rounded hover:bg-muted {selectedDateRange ===
							'today'
								? 'bg-primary/10 text-primary'
								: ''}"
						>
							Hari Ini
						</button>
						<button
							onclick={() => {
								selectedDateRange = 'week';
								showDateFilter = false;
							}}
							class="w-full text-left px-3 py-2 rounded hover:bg-muted {selectedDateRange === 'week'
								? 'bg-primary/10 text-primary'
								: ''}"
						>
							Minggu Ini
						</button>
						<button
							onclick={() => {
								selectedDateRange = 'month';
								showDateFilter = false;
							}}
							class="w-full text-left px-3 py-2 rounded hover:bg-muted {selectedDateRange ===
							'month'
								? 'bg-primary/10 text-primary'
								: ''}"
						>
							Bulan Ini
						</button>
						<hr class="my-2" />
						<div class="space-y-2">
							<label class="text-xs text-muted-foreground">Custom Range</label>
							<div class="flex gap-2">
								<input
									type="date"
									bind:value={customStartDate}
									class="flex-1 px-2 py-1 text-sm border rounded"
								/>
								<input
									type="date"
									bind:value={customEndDate}
									class="flex-1 px-2 py-1 text-sm border rounded"
								/>
							</div>
							<button
								onclick={() => {
									selectedDateRange = 'custom';
									showDateFilter = false;
								}}
								class="w-full px-4 py-3 min-h-[48px] text-base bg-primary text-primary-foreground rounded hover:bg-primary/90"
							>
								Terapkan
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Transaction Table -->
	{#if filteredTransactions.length > 0}
		<div class="bg-card border rounded-lg overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr class="border-b bg-muted/50">
							<th class="text-left px-4 py-3 font-medium text-sm">
								<button
									onclick={() => toggleSort('date')}
									class="flex items-center gap-1 hover:text-foreground"
								>
									Tanggal
									{#if sortBy === 'date'}
										<span class="text-xs">{sortOrder === 'desc' ? '↓' : '↑'}</span>
									{/if}
								</button>
							</th>
							<th class="text-left px-4 py-3 font-medium text-sm">Kategori</th>
							<th class="text-left px-4 py-3 font-medium text-sm">Akun</th>
							<th class="text-left px-4 py-3 font-medium text-sm hidden md:table-cell"
								>Keterangan</th
							>
							<th class="text-right px-4 py-3 font-medium text-sm">
								<button
									onclick={() => toggleSort('amount')}
									class="flex items-center gap-1 hover:text-foreground ml-auto"
								>
									Jumlah
									{#if sortBy === 'amount'}
										<span class="text-xs">{sortOrder === 'desc' ? '↓' : '↑'}</span>
									{/if}
								</button>
							</th>
							<th class="text-right px-4 py-3 font-medium text-sm">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedTransactions as txn (txn.id)}
							<tr class="border-b hover:bg-muted/30 transition-colors">
								<td class="px-4 py-3 text-sm">
									{formatDate(txn.date)}
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										<div
											class="w-6 h-6 rounded-full flex items-center justify-center text-xs"
											style="background-color: {txn.category?.color || '#6b7280'}"
										>
											{txn.category?.icon || '📁'}
										</div>
										<span class="text-sm">{txn.category?.name || '-'}</span>
									</div>
								</td>
								<td class="px-4 py-3 text-sm">{txn.account?.name || '-'}</td>
								<td
									class="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell truncate max-w-[150px]"
								>
									{txn.description || '-'}
								</td>
								<td class="px-4 py-3 text-right">
									<span
										class="font-medium {txn.type === 'income' ? 'text-green-600' : 'text-red-600'}"
									>
										{formatTransactionAmount(txn.amount, txn.type as 'income' | 'expense')}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										<a
											href="/transaksi/{txn.id}"
											class="p-1.5 hover:bg-secondary rounded transition-colors"
											aria-label="Edit transaksi"
										>
											<Pencil class="w-4 h-4" />
										</a>
										<button
											onclick={() => (showDeleteConfirm = txn.id)}
											class="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
											aria-label="Hapus transaksi"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div class="flex items-center justify-between px-4 py-3 border-t">
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">Baris per halaman:</span>
					<select bind:value={pageSize} class="px-2 py-1 border rounded text-sm">
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
					</select>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">
						Halaman {currentPage} dari {totalPages}
					</span>
					<button
						onclick={() => currentPage--}
						disabled={currentPage === 1}
						class="p-1 rounded hover:bg-secondary disabled:opacity-50"
					>
						<ChevronLeft class="w-4 h-4" />
					</button>
					<button
						onclick={() => currentPage++}
						disabled={currentPage >= totalPages}
						class="p-1 rounded hover:bg-secondary disabled:opacity-50"
					>
						<ChevronRight class="w-4 h-4" />
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
				<Plus class="w-8 h-8 text-muted-foreground" />
			</div>
			<h3 class="text-lg font-medium mb-2">Belum ada transaksi. Yuk, catat yang pertama!</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				Catat transaksi pertama Anda untuk memulai keuangan yang lebih tertata!
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
</div>

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-background border rounded-lg shadow-lg w-full max-w-md p-6">
			<h2 class="text-lg font-semibold mb-2">Hapus Transaksi?</h2>
			<p class="text-sm text-muted-foreground mb-6">
				Transaksi yang dihapus tidak dapat dikembalikan. Apakah Anda yakin ingin melanjutkan?
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (showDeleteConfirm = null)}
					class="flex-1 px-4 py-3 min-h-[48px] text-base border rounded-md font-medium hover:bg-secondary transition-colors"
				>
					Batal
				</button>
				<button
					onclick={() => handleDelete(showDeleteConfirm!)}
					disabled={deletingId !== null}
					class="flex-1 px-4 py-3 min-h-[48px] text-base bg-destructive text-destructive-foreground rounded-md font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
				>
					{deletingId ? 'Menghapus...' : 'Hapus'}
				</button>
			</div>
		</div>
	</div>
{/if}

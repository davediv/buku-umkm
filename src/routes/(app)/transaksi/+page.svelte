<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		AlertCircle,
		Calendar,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		Download,
		FileSpreadsheet,
		FileText,
		Pencil,
		Plus,
		Search,
		Trash2
	} from '@lucide/svelte';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogDescription,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { toast } from '$lib/components/ui/toast';
	import {
		getTransactionHref,
		toTransactionSearchParams,
		type TransactionDateRange,
		type TransactionTypeFilter
	} from '$lib/transactions/query';
	import {
		exportTransactions,
		generateExportFilename,
		type ExportFormat,
		type TransactionForExport
	} from '$lib/utils/export';
	import { formatDate, formatDateShort, formatRupiah, formatTransactionAmount } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $derived(data.query);
	let pagination = $derived(data.pagination);
	let successMessage = $derived(getSuccessMessage(page.url.searchParams.get('success')));
	let deletingId = $state<string | null>(null);
	let showDeleteConfirm = $state<string | null>(null);
	let isExporting = $state(false);

	let searchInput = $state('');
	let typeInput = $state<TransactionTypeFilter>('all');
	let rangeInput = $state<TransactionDateRange>('month');
	let customStartDate = $state('');
	let customEndDate = $state('');

	function getSuccessMessage(status: string | null): string | null {
		switch (status) {
			case 'true':
			case 'created':
				return 'Transaksi berhasil disimpan.';
			case 'created-without-receipts':
				return 'Transaksi berhasil disimpan tanpa foto nota.';
			case 'updated':
				return 'Perubahan transaksi berhasil disimpan.';
			case 'deleted':
				return 'Transaksi berhasil dihapus dan saldo telah disesuaikan.';
			default:
				return null;
		}
	}

	$effect(() => {
		searchInput = query.q;
		typeInput = query.type;
		rangeInput = query.range;
		customStartDate = query.range === 'custom' ? (query.startDate ?? '') : '';
		customEndDate = query.range === 'custom' ? (query.endDate ?? '') : '';
	});

	let hasAppliedFilters = $derived(query.q !== '' || query.type !== 'all' || query.range !== 'all');
	let firstVisible = $derived(pagination.total === 0 ? 0 : pagination.offset + 1);
	let lastVisible = $derived(
		Math.min(pagination.offset + data.transactions.length, pagination.total)
	);

	function dateRangeLabel(): string {
		switch (query.range) {
			case 'all':
				return 'Semua tanggal';
			case 'today':
				return 'Hari ini';
			case 'week':
				return 'Minggu ini';
			case 'month':
				return 'Bulan ini';
			case 'custom':
				return query.startDate && query.endDate
					? `${formatDateShort(query.startDate)} – ${formatDateShort(query.endDate)}`
					: 'Rentang khusus';
		}
	}

	function sortHref(column: 'date' | 'amount'): string {
		return getTransactionHref(query, {
			sortBy: column,
			sortOrder:
				query.sortBy === column && query.sortOrder === 'desc'
					? 'asc'
					: query.sortBy === column
						? 'desc'
						: 'desc',
			page: 1
		});
	}

	function formatAmount(amount: number, type: string): string {
		if (type === 'transfer') return formatRupiah(amount);
		return formatTransactionAmount(amount, type as 'income' | 'expense');
	}

	async function changePageSize(event: Event) {
		const pageSize = Number((event.currentTarget as HTMLSelectElement).value) as 10 | 25 | 50;
		await goto(getTransactionHref(query, { pageSize, page: 1 }), { noScroll: true });
	}

	async function handleDelete(transactionId: string) {
		deletingId = transactionId;
		try {
			const response = await fetch(`/api/transactions/${transactionId}`, { method: 'DELETE' });
			if (!response.ok) {
				const result = (await response.json()) as { error?: string };
				throw new Error(result.error || 'Gagal menghapus transaksi');
			}

			toast.success('Transaksi dihapus');
			if (data.transactions.length === 1 && pagination.page > 1) {
				await goto(getTransactionHref(query, { page: pagination.page - 1 }), { noScroll: true });
			} else {
				await invalidateAll();
			}
		} catch (error) {
			console.error('Error deleting transaction:', error);
			toast.error(
				'Gagal menghapus',
				error instanceof Error ? error.message : 'Terjadi kesalahan server'
			);
		} finally {
			deletingId = null;
			showDeleteConfirm = null;
		}
	}

	async function handleExport(format: ExportFormat) {
		if (isExporting) return;
		isExporting = true;

		try {
			const params = toTransactionSearchParams(query, {}, false);
			const response = await fetch(`/api/transactions/export?${params.toString()}`);
			if (!response.ok) throw new Error('Gagal mengambil data ekspor');

			const result = (await response.json()) as { transactions: TransactionForExport[] };
			if (result.transactions.length === 0) {
				toast.warning('Tidak ada transaksi', 'Tidak ada hasil yang dapat diekspor');
				return;
			}

			const filename = generateExportFilename('transaksi');
			await exportTransactions(result.transactions, format, filename);
			toast.success('Berhasil mengekspor', `${result.transactions.length} transaksi diunduh`);
		} catch (error) {
			console.error('Error exporting transactions:', error);
			toast.error('Gagal mengekspor', 'Coba ulangi setelah data termuat');
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Daftar Transaksi - Buku UMKM</title>
</svelte:head>

<div class="space-y-4 p-4 md:p-6">
	<header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Transaksi</h1>
			<p class="text-sm text-muted-foreground">Cari dan kelola seluruh catatan keuangan Anda</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<details class="group relative">
				<summary
					class="inline-flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-base font-medium transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden"
				>
					<Download class="h-4 w-4" />
					{isExporting ? 'Mengekspor…' : 'Ekspor hasil'}
					<ChevronDown class="h-4 w-4 transition-transform group-open:rotate-180" />
				</summary>
				<div
					class="absolute right-0 top-full z-20 mt-2 min-w-52 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl"
				>
					<button
						type="button"
						onclick={() => handleExport('xlsx')}
						disabled={isExporting}
						class="flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-muted disabled:opacity-50"
					>
						<FileSpreadsheet class="h-4 w-4 text-green-700" />
						Excel (.xlsx)
					</button>
					<button
						type="button"
						onclick={() => handleExport('csv')}
						disabled={isExporting}
						class="flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-muted disabled:opacity-50"
					>
						<FileText class="h-4 w-4 text-blue-700" />
						CSV (.csv)
					</button>
				</div>
			</details>
			<a
				href="/transaksi/tambah"
				class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<Plus class="h-4 w-4" />
				Tambah Transaksi
			</a>
		</div>
	</header>

	{#if successMessage}
		<div
			class="rounded-md border border-green-500 bg-green-500/10 p-3 text-sm text-green-700"
			role="status"
		>
			{successMessage}
		</div>
	{/if}

	<form
		method="GET"
		class="grid gap-3 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto]"
	>
		<div class="relative">
			<label for="transaction-search" class="sr-only">Cari transaksi</label>
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				id="transaction-search"
				name="q"
				type="search"
				bind:value={searchInput}
				placeholder="Keterangan, kategori, rekening…"
				class="h-11 w-full rounded-md border bg-background pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
		</div>

		<label class="grid gap-1 text-xs text-muted-foreground">
			Jenis
			<select
				name="type"
				bind:value={typeInput}
				class="h-11 rounded-md border bg-background px-3 text-sm text-foreground"
			>
				<option value="all">Semua jenis</option>
				<option value="income">Pemasukan</option>
				<option value="expense">Pengeluaran</option>
				<option value="transfer">Transfer</option>
			</select>
		</label>

		<label class="grid gap-1 text-xs text-muted-foreground">
			Tanggal
			<select
				name="range"
				bind:value={rangeInput}
				class="h-11 rounded-md border bg-background px-3 text-sm text-foreground"
			>
				<option value="all">Semua tanggal</option>
				<option value="today">Hari ini</option>
				<option value="week">Minggu ini</option>
				<option value="month">Bulan ini</option>
				<option value="custom">Rentang khusus</option>
			</select>
		</label>

		<div class="flex items-end gap-2">
			<input type="hidden" name="sort" value={query.sortBy} />
			<input type="hidden" name="order" value={query.sortOrder} />
			<input type="hidden" name="page_size" value={query.pageSize} />
			<button
				type="submit"
				class="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
			>
				Terapkan
			</button>
			{#if hasAppliedFilters}
				<a
					href="/transaksi?range=all&sort=date&order=desc&page=1&page_size={query.pageSize}"
					class="inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
				>
					Reset
				</a>
			{/if}
		</div>

		{#if rangeInput === 'custom'}
			<div class="grid gap-3 sm:grid-cols-2 lg:col-span-4">
				<label class="grid gap-1 text-xs text-muted-foreground">
					Dari tanggal
					<input
						name="start"
						type="date"
						bind:value={customStartDate}
						required
						class="h-11 rounded-md border bg-background px-3 text-sm text-foreground"
					/>
				</label>
				<label class="grid gap-1 text-xs text-muted-foreground">
					Sampai tanggal
					<input
						name="end"
						type="date"
						bind:value={customEndDate}
						required
						class="h-11 rounded-md border bg-background px-3 text-sm text-foreground"
					/>
				</label>
			</div>
		{/if}
	</form>

	<div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
		<p><Calendar class="mr-1 inline h-4 w-4" />{dateRangeLabel()}</p>
		<p>{pagination.total.toLocaleString('id-ID')} hasil</p>
	</div>

	{#if data.error}
		<section
			class="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center"
		>
			<AlertCircle class="mb-3 h-10 w-10 text-destructive" />
			<h2 class="font-semibold">Transaksi tidak dapat dimuat</h2>
			<p class="mt-1 text-sm text-muted-foreground">{data.error}</p>
			<a
				href={getTransactionHref(query)}
				class="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
				>Coba lagi</a
			>
		</section>
	{:else if data.transactions.length > 0}
		<div class="overflow-hidden rounded-xl border bg-card">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[760px]">
					<thead>
						<tr class="border-b bg-muted/50">
							<th scope="col" class="px-4 py-3 text-left text-sm font-medium">
								<a
									href={sortHref('date')}
									class="inline-flex min-h-11 items-center gap-1 hover:text-foreground"
								>
									Tanggal {query.sortBy === 'date' ? (query.sortOrder === 'desc' ? '↓' : '↑') : ''}
								</a>
							</th>
							<th scope="col" class="px-4 py-3 text-left text-sm font-medium">Kategori</th>
							<th scope="col" class="px-4 py-3 text-left text-sm font-medium">Rekening</th>
							<th scope="col" class="px-4 py-3 text-left text-sm font-medium">Keterangan</th>
							<th scope="col" class="px-4 py-3 text-right text-sm font-medium">
								<a
									href={sortHref('amount')}
									class="inline-flex min-h-11 items-center gap-1 hover:text-foreground"
								>
									Jumlah {query.sortBy === 'amount' ? (query.sortOrder === 'desc' ? '↓' : '↑') : ''}
								</a>
							</th>
							<th scope="col" class="px-4 py-3 text-right text-sm font-medium">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each data.transactions as transaction (transaction.id)}
							<tr class="border-b transition-colors last:border-0 hover:bg-muted/30">
								<td class="whitespace-nowrap px-4 py-3 text-sm">{formatDate(transaction.date)}</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-2">
										<span
											class="flex h-6 w-6 items-center justify-center rounded-full text-xs"
											style="background-color: {transaction.category?.color || '#e5e7eb'}"
										>
											{transaction.category?.icon || (transaction.type === 'transfer' ? '↔' : '📁')}
										</span>
										<span class="text-sm"
											>{transaction.category?.name ||
												(transaction.type === 'transfer' ? 'Transfer' : '-')}</span
										>
									</div>
								</td>
								<td class="px-4 py-3 text-sm">
									{transaction.account?.name || '-'}{transaction.toAccount?.name
										? ` → ${transaction.toAccount.name}`
										: ''}
								</td>
								<td class="max-w-52 truncate px-4 py-3 text-sm text-muted-foreground"
									>{transaction.description || '-'}</td
								>
								<td class="px-4 py-3 text-right">
									<span
										class="font-medium {transaction.type === 'income'
											? 'text-green-700'
											: transaction.type === 'expense'
												? 'text-red-700'
												: ''}"
									>
										{formatAmount(transaction.amount, transaction.type)}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex justify-end gap-1">
										<a
											href="/transaksi/{transaction.id}"
											class="flex h-11 w-11 items-center justify-center rounded hover:bg-secondary"
											aria-label="Edit transaksi"
										>
											<Pencil class="h-4 w-4" />
										</a>
										<button
											type="button"
											onclick={() => (showDeleteConfirm = transaction.id)}
											class="flex h-11 w-11 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
											aria-label="Hapus transaksi"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<footer
				class="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<label class="flex items-center gap-2 text-sm text-muted-foreground">
					Baris per halaman
					<select
						value={query.pageSize}
						onchange={changePageSize}
						class="h-10 rounded border bg-background px-2 text-sm text-foreground"
					>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
					</select>
				</label>
				<div class="flex items-center justify-between gap-2 sm:justify-end">
					<span class="text-sm text-muted-foreground"
						>{firstVisible}–{lastVisible} dari {pagination.total}</span
					>
					<a
						href={getTransactionHref(query, { page: pagination.page - 1 })}
						aria-disabled={pagination.page === 1}
						class="flex h-11 w-11 items-center justify-center rounded hover:bg-secondary {pagination.page ===
						1
							? 'pointer-events-none opacity-40'
							: ''}"
						aria-label="Halaman sebelumnya"
					>
						<ChevronLeft class="h-4 w-4" />
					</a>
					<span class="text-sm">{pagination.page}/{pagination.totalPages}</span>
					<a
						href={getTransactionHref(query, { page: pagination.page + 1 })}
						aria-disabled={pagination.page === pagination.totalPages}
						class="flex h-11 w-11 items-center justify-center rounded hover:bg-secondary {pagination.page ===
						pagination.totalPages
							? 'pointer-events-none opacity-40'
							: ''}"
						aria-label="Halaman berikutnya"
					>
						<ChevronRight class="h-4 w-4" />
					</a>
				</div>
			</footer>
		</div>
	{:else}
		<section
			class="flex flex-col items-center justify-center rounded-xl border bg-card py-12 text-center"
		>
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				{#if hasAppliedFilters}<Search class="h-8 w-8 text-muted-foreground" />{:else}<Plus
						class="h-8 w-8 text-muted-foreground"
					/>{/if}
			</div>
			<h2 class="text-lg font-medium">
				{hasAppliedFilters ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi'}
			</h2>
			<p class="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
				{hasAppliedFilters
					? 'Ubah pencarian atau filter untuk melihat hasil lain.'
					: 'Catat transaksi pertama untuk mulai menyusun pembukuan.'}
			</p>
			{#if hasAppliedFilters}
				<a
					href="/transaksi?range=all&sort=date&order=desc&page=1&page_size={query.pageSize}"
					class="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium"
					>Hapus semua filter</a
				>
			{:else}
				<a
					href="/transaksi/tambah"
					class="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
				>
					<Plus class="h-4 w-4" />Tambah Transaksi
				</a>
			{/if}
		</section>
	{/if}
</div>

<AlertDialog
	open={!!showDeleteConfirm}
	closeOnExternalClick={deletingId === null}
	onopenchange={(open) => !open && (showDeleteConfirm = null)}
>
	<AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
	<AlertDialogDescription>
		Transaksi yang dihapus tidak dapat dikembalikan. Saldo terkait akan diperbarui.
	</AlertDialogDescription>
	<div class="mt-6 flex gap-3">
		<AlertDialogCancel onclick={() => (showDeleteConfirm = null)}>Batal</AlertDialogCancel>
		<AlertDialogAction
			onclick={() => handleDelete(showDeleteConfirm!)}
			loading={deletingId !== null}
		>
			{deletingId ? 'Menghapus…' : 'Hapus'}
		</AlertDialogAction>
	</div>
</AlertDialog>

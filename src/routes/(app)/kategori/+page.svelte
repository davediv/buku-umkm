<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		Tags,
		Plus,
		X,
		Pencil,
		Trash2,
		ArrowDownToLine,
		ArrowUpFromLine,
		ToggleLeft,
		ToggleRight,
		Shield
	} from '@lucide/svelte';
	import OperationStatus from '$lib/components/operation-status.svelte';
	import {
		AlertDialog,
		AlertDialogTitle,
		AlertDialogDescription,
		AlertDialogAction,
		AlertDialogCancel
	} from '$lib/components/ui/alert-dialog';
	import { getSafeTransactionReturn } from '$lib/client/transaction-return';
	import { getIncomeExpenseViewHref, resolveIncomeExpenseView } from '$lib/navigation/view-state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let showModal = $state(false);
	let editingCategory = $state<{ id: string; name: string } | null>(null);
	let loading = $state(false);
	let deletingId = $state<string | null>(null);
	let togglingId = $state<string | null>(null);
	let showDeleteConfirm = $state(false);
	let deleteTargetId = $state<string | null>(null);
	let activeTab = $derived(resolveIncomeExpenseView(page.url.searchParams.get('type')));
	let operationStatus = $state<{ kind: 'success' | 'error'; message: string } | null>(null);
	let transactionReturnTo = $derived(
		getSafeTransactionReturn(page.url.searchParams.get('return_to'))
	);

	// Form data
	let name = $state('');
	let type = $state<'income' | 'expense'>('expense');

	// Local mutable categories state — syncs from load data, allows optimistic updates
	let incomeCategories = $derived(data.categories.income);
	let expenseCategories = $derived(data.categories.expense);

	// Get current categories based on tab
	let currentCategories = $derived(activeTab === 'income' ? incomeCategories : expenseCategories);
	let incomeHref = $derived(getIncomeExpenseViewHref('/kategori', page.url.searchParams, 'income'));
	let expenseHref = $derived(
		getIncomeExpenseViewHref('/kategori', page.url.searchParams, 'expense')
	);

	// SAK EMKM group names
	const sakEmkmGroups: Record<string, string> = {
		'4': 'Pendapatan (Revenue)',
		'5': 'Beban Pokok Penjualan',
		'6': 'Beban Operasional',
		'7': 'Beban Lain-lain'
	};

	// Open modal for creating new category
	function openCreateModal() {
		operationStatus = null;
		editingCategory = null;
		name = '';
		type = activeTab;
		showModal = true;
	}

	// Open modal for editing
	function openEditModal(category: { id: string; name: string }) {
		operationStatus = null;
		editingCategory = category;
		name = category.name;
		type = activeTab;
		showModal = true;
	}

	// Close modal
	function closeModal() {
		showModal = false;
		editingCategory = null;
		name = '';
		type = activeTab;
	}

	// Handle form submission
	function handleSubmit() {
		loading = true;
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			try {
				if (result.type === 'success') {
					operationStatus = {
						kind: 'success',
						message:
							typeof result.data?.message === 'string'
								? result.data.message
								: 'Kategori berhasil disimpan.'
					};
					await invalidateAll();
					closeModal();
					return;
				}

				operationStatus = {
					kind: 'error',
					message:
						typeof result.data?.error === 'string'
							? result.data.error
							: 'Kategori belum dapat disimpan.'
				};
			} finally {
				loading = false;
			}
		};
	}

	// Handle toggle
	async function handleToggle(categoryId: string, currentActive: boolean) {
		togglingId = categoryId;
		try {
			const response = await fetch(`/api/categories/${categoryId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isActive: !currentActive })
			});
			const resData = (await response.json()) as { error?: string; message?: string };

			if (response.ok) {
				await invalidateAll();
				operationStatus = {
					kind: 'success',
					message:
						resData.message ??
						`Kategori berhasil ${currentActive ? 'dinonaktifkan' : 'diaktifkan'}.`
				};
			} else {
				operationStatus = {
					kind: 'error',
					message: resData.error || 'Status kategori belum dapat diubah.'
				};
			}
		} catch (error) {
			console.error('Error toggling category:', error);
			operationStatus = {
				kind: 'error',
				message: 'Tidak dapat terhubung ke server. Status kategori belum diubah.'
			};
		} finally {
			togglingId = null;
		}
	}

	function closeDeleteDialog() {
		showDeleteConfirm = false;
		deleteTargetId = null;
	}

	// Prompt delete confirmation
	function promptDelete(categoryId: string) {
		deleteTargetId = categoryId;
		showDeleteConfirm = true;
	}

	// Handle delete (called from confirmation dialog)
	async function handleDelete() {
		if (!deleteTargetId) return;

		deletingId = deleteTargetId;
		showDeleteConfirm = false;
		try {
			const response = await fetch(`/api/categories/${deleteTargetId}`, {
				method: 'DELETE'
			});
			const resData = (await response.json()) as { error?: string; message?: string };

			if (response.ok) {
				await invalidateAll();
				operationStatus = {
					kind: 'success',
					message: resData.message ?? 'Kategori berhasil dihapus.'
				};
			} else {
				operationStatus = {
					kind: 'error',
					message: resData.error || 'Kategori belum dapat dihapus.'
				};
			}
		} catch (error) {
			console.error('Error deleting category:', error);
			operationStatus = {
				kind: 'error',
				message: 'Tidak dapat terhubung ke server. Kategori belum dihapus.'
			};
		} finally {
			deletingId = null;
			deleteTargetId = null;
		}
	}
</script>

<svelte:head>
	<title>Kelola Kategori - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	{#if transactionReturnTo}
		<a
			href={transactionReturnTo}
			class="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-900 hover:bg-blue-100"
		>
			<ArrowLeft class="h-4 w-4" />
			Kembali ke transaksi yang sedang dicatat
		</a>
	{/if}

	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Kelola Kategori</h1>
			<p class="text-sm text-muted-foreground">
				Kelola kategori transaksi pendapatan dan pengeluaran Anda
			</p>
		</div>
		<button
			onclick={openCreateModal}
			class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
		>
			<Plus class="w-4 h-4" />
			Tambah Kategori
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex gap-2 border-b">
		<a
			href={incomeHref}
			class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors {activeTab === 'income'
				? 'border-primary text-primary font-medium'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<ArrowUpFromLine class="w-4 h-4" />
			Pemasukan
			<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
				>{incomeCategories.all.length}</span
			>
		</a>
		<a
			href={expenseHref}
			class="flex items-center gap-2 px-4 py-2 border-b-2 transition-colors {activeTab === 'expense'
				? 'border-primary text-primary font-medium'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<ArrowDownToLine class="w-4 h-4" />
			Pengeluaran
			<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
				>{expenseCategories.all.length}</span
			>
		</a>
	</div>

	{#if operationStatus && !showModal}
		<OperationStatus
			kind={operationStatus.kind}
			message={operationStatus.message}
			ondismiss={() => (operationStatus = null)}
		/>
	{/if}

	<!-- Categories List Grouped by SAK EMKM -->
	{#if currentCategories.all.length > 0}
		<div class="space-y-6">
			{#each Object.entries(currentCategories.groups) as [prefix, categories] (prefix)}
				<div class="bg-card border rounded-lg overflow-hidden">
					<div class="bg-muted/50 px-4 py-2 border-b">
						<h3 class="font-medium text-sm">
							{sakEmkmGroups[prefix] || `Kelompok ${prefix}xxx`}
						</h3>
					</div>
					<div class="divide-y">
						{#each categories as category (category.id)}
							<div
								class="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors {!category.isActive
									? 'opacity-50'
									: ''}"
							>
								<div class="flex items-center gap-3">
									<div
										class="w-3 h-3 rounded-full"
										style="background-color: {category.color || '#6b7280'}"
									></div>
									<div>
										<div class="flex items-center gap-2">
											<span class="font-medium">{category.name}</span>
											{#if category.isSystem}
												<span
													class="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
												>
													<Shield class="w-3 h-3" />
													Sistem
												</span>
											{/if}
											{#if !category.isActive}
												<span
													class="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded"
												>
													Nonaktif
												</span>
											{/if}
										</div>
										<p class="text-xs text-muted-foreground">Kode: {category.code}</p>
									</div>
								</div>
								<div class="flex gap-1">
									{#if !category.isSystem}
										<button
											onclick={() => openEditModal(category)}
											class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
											aria-label="Edit kategori"
										>
											<Pencil class="w-4 h-4" />
										</button>
										<button
											onclick={() => promptDelete(category.id)}
											disabled={deletingId === category.id}
											class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
											aria-label="Hapus kategori"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									{/if}
									<button
										onclick={() => handleToggle(category.id, category.isActive)}
										disabled={togglingId === category.id}
										class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors disabled:opacity-50"
										aria-label={category.isActive ? 'Nonaktifkan' : 'Aktifkan'}
									>
										{#if category.isActive}
											<ToggleRight class="w-4 h-4 text-green-500" />
										{:else}
											<ToggleLeft class="w-4 h-4" />
										{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
				<Tags class="w-8 h-8 text-muted-foreground" />
			</div>
			<h3 class="text-lg font-medium mb-2">Belum ada kategori</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				Yuk, buat kategori pertama Anda untuk mulai mengklasifikasikan transaksi!
			</p>
			<button
				onclick={openCreateModal}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Tambah Kategori
			</button>
		</div>
	{/if}
</div>

<!-- Modal for Create/Edit Category -->
{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="bg-white border rounded-lg shadow-xl w-full max-w-md p-6">
			<div class="flex items-center justify-between mb-6">
				<h2 id="modal-title" class="text-lg font-semibold">
					{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
				</h2>
				<button
					onclick={closeModal}
					class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="post"
				action={editingCategory ? '?/update' : '?/create'}
				use:enhance={handleSubmit}
				class="space-y-4"
			>
				{#if operationStatus}
					<OperationStatus kind={operationStatus.kind} message={operationStatus.message} />
				{/if}
				{#if editingCategory}
					<input type="hidden" name="id" value={editingCategory.id} />
				{/if}

				<div class="space-y-2">
					<label for="name" class="text-sm font-medium">Nama Kategori</label>
					<input
						id="name"
						name="name"
						type="text"
						bind:value={name}
						placeholder="Contoh: Penjualan Makanan, Beban Listrik"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
				</div>

				{#if !editingCategory}
					<div class="space-y-2">
						<label for="type" class="text-sm font-medium">Tipe Kategori</label>
						<select
							id="type"
							name="type"
							bind:value={type}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="income">Pemasukan</option>
							<option value="expense">Pengeluaran</option>
						</select>
						<p class="text-xs text-muted-foreground">
							Pemasukan untuk menerima uang, Pengeluaran untuk pengeluaran uang
						</p>
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
						class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
					>
						{loading ? 'Menyimpan...' : editingCategory ? 'Simpan Perubahan' : 'Buat Kategori'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
<AlertDialog
	open={showDeleteConfirm}
	onopenchange={(open) => {
		if (!open) closeDeleteDialog();
	}}
>
	<AlertDialogTitle>Hapus atau Nonaktifkan Kategori?</AlertDialogTitle>
	<AlertDialogDescription>
		Kategori yang belum dipakai akan dihapus. Jika sudah memiliki transaksi, kategori hanya
		dinonaktifkan agar catatan lama tetap utuh.
	</AlertDialogDescription>
	<div class="flex gap-3 mt-6">
		<AlertDialogCancel onclick={closeDeleteDialog}>Batal</AlertDialogCancel>
		<AlertDialogAction onclick={handleDelete}>Lanjutkan</AlertDialogAction>
	</div>
</AlertDialog>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import {
		FileText,
		Plus,
		X,
		Pencil,
		Trash2,
		ToggleLeft,
		ToggleRight,
		Shield,
		ArrowLeft
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// State
	let showModal = $state(false);
	let editingTemplate = $state<{
		id: string;
		name: string;
		type: 'income' | 'expense';
		categoryId: string | null;
		description: string | null;
	} | null>(null);
	let loading = $state(false);
	let deletingId = $state<string | null>(null);
	let togglingId = $state<string | null>(null);
	let activeTab = $state<'income' | 'expense'>('income');

	// Form data
	let name = $state('');
	let type = $state<'income' | 'expense'>('expense');
	let categoryId = $state('');
	let description = $state('');

	// Derived
	let incomeTemplates = $derived(
		data.templates.filter((t: { type: string; isActive: boolean }) => t.type === 'income')
	);
	let expenseTemplates = $derived(
		data.templates.filter((t: { type: string; isActive: boolean }) => t.type === 'expense')
	);

	// Get current templates based on tab
	let currentTemplates = $derived(activeTab === 'income' ? incomeTemplates : expenseTemplates);

	// Get categories for form based on selected type
	let formCategories = $derived(
		type === 'income' ? data.categories.income : data.categories.expense
	);

	// Open modal for creating new template
	function openCreateModal() {
		editingTemplate = null;
		name = '';
		type = activeTab;
		categoryId = '';
		description = '';
		showModal = true;
	}

	// Open modal for editing
	function openEditModal(tmpl: {
		id: string;
		name: string;
		type: string;
		categoryId: string | null;
		description: string | null;
	}) {
		editingTemplate = { ...tmpl, type: tmpl.type as 'income' | 'expense' };
		name = tmpl.name;
		type = tmpl.type as 'income' | 'expense';
		categoryId = tmpl.categoryId || '';
		description = tmpl.description || '';
		showModal = true;
	}

	// Close modal
	function closeModal() {
		showModal = false;
		editingTemplate = null;
		name = '';
		type = 'expense';
		categoryId = '';
		description = '';
	}

	// Handle form submission
	function handleSubmit() {
		loading = true;
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			loading = false;
			if (result.type === 'success') {
				closeModal();
				await update();
			}
		};
	}

	// Handle toggle
	async function handleToggle(templateId: string, currentActive: boolean) {
		togglingId = templateId;
		try {
			const formData = new FormData();
			formData.append('id', templateId);
			formData.append('isActive', String(!currentActive));

			const response = await fetch('?/toggle', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await invalidate('?/');
			} else {
				const resData = (await response.json()) as { error?: string };
				alert(resData.error || 'Gagal mengubah status');
			}
		} catch (error) {
			console.error('Error toggling template:', error);
			alert('Terjadi kesalahan server');
		} finally {
			togglingId = null;
		}
	}

	// Handle delete
	async function handleDelete(templateId: string) {
		if (!confirm('Apakah Anda yakin ingin menghapus template ini?')) {
			return;
		}

		deletingId = templateId;
		try {
			const formData = new FormData();
			formData.append('id', templateId);

			const response = await fetch('?/delete', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await invalidate('?/');
			} else {
				const resData = (await response.json()) as { error?: string };
				alert(resData.error || 'Gagal menghapus template');
			}
		} catch (error) {
			console.error('Error deleting template:', error);
			alert('Terjadi kesalahan server');
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head>
	<title>Kelola Template - Buku UMKM</title>
</svelte:head>

<div class="min-h-screen bg-background flex flex-col">
	<!-- Header -->
	<header class="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
		<a
			href="/transaksi"
			class="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
			aria-label="Kembali"
		>
			<ArrowLeft class="w-5 h-5" />
		</a>
		<h1 class="text-lg font-semibold">Kelola Template</h1>
	</header>

	<!-- Tab Navigation -->
	<div class="border-b px-4 pt-4">
		<div class="flex gap-1 bg-muted p-1 rounded-lg">
			<button
				type="button"
				onclick={() => (activeTab = 'income')}
				class="flex-1 py-2 px-4 rounded-md font-medium transition-all {activeTab === 'income'
					? 'bg-green-500 text-white'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				Pemasukan
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'expense')}
				class="flex-1 py-2 px-4 rounded-md font-medium transition-all {activeTab === 'expense'
					? 'bg-red-500 text-white'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				Pengeluaran
			</button>
		</div>
	</div>

	<!-- Template List -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if currentTemplates.length > 0}
			<div class="space-y-2">
				{#each currentTemplates as tmpl (tmpl.id)}
					<div
						class="flex items-center gap-3 p-4 bg-card rounded-lg border {tmpl.isActive
							? ''
							: 'opacity-60'}"
					>
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center {tmpl.type === 'income'
								? 'bg-green-100 text-green-600'
								: 'bg-red-100 text-red-600'}"
						>
							<FileText class="w-5 h-5" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium truncate">{tmpl.name}</span>
								{#if tmpl.isSystem}
									<Shield class="w-3 h-3 text-muted-foreground" />
								{/if}
							</div>
							<div class="text-sm text-muted-foreground">
								{#if tmpl.categoryName}
									<span class="truncate">Kategori: {tmpl.categoryName}</span>
								{/if}
								{#if tmpl.description}
									<span class="truncate"> - {tmpl.description}</span>
								{/if}
								{#if !tmpl.categoryName && !tmpl.description}
									<span class="text-xs">Tanpa kategori</span>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-1">
							{#if !tmpl.isSystem}
								<button
									type="button"
									onclick={() => openEditModal(tmpl)}
									class="p-2 hover:bg-secondary rounded-full transition-colors"
									aria-label="Edit"
								>
									<Pencil class="w-4 h-4" />
								</button>
								<button
									type="button"
									onclick={() => handleDelete(tmpl.id)}
									disabled={deletingId === tmpl.id}
									class="p-2 hover:bg-secondary rounded-full transition-colors text-destructive"
									aria-label="Hapus"
								>
									<Trash2 class="w-4 h-4" />
								</button>
							{/if}
							<button
								type="button"
								onclick={() => handleToggle(tmpl.id, tmpl.isActive)}
								disabled={togglingId === tmpl.id}
								class="p-2 hover:bg-secondary rounded-full transition-colors"
								aria-label={tmpl.isActive ? 'Nonaktifkan' : 'Aktifkan'}
							>
								{#if tmpl.isActive}
									<ToggleRight class="w-5 h-5 text-green-500" />
								{:else}
									<ToggleLeft class="w-5 h-5 text-muted-foreground" />
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
					<FileText class="w-8 h-8 text-muted-foreground" />
				</div>
				<p class="text-muted-foreground mb-2">Belum ada template</p>
				<p class="text-sm text-muted-foreground">Tambahkan template untuk Transaksi masuk更快</p>
			</div>
		{/if}
	</div>

	<!-- Add Button -->
	<div class="p-4 border-t bg-background">
		<button
			type="button"
			onclick={openCreateModal}
			class="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
		>
			<Plus class="w-5 h-5" />
			Tambah Template
		</button>
	</div>
</div>

<!-- Modal -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-background border rounded-lg shadow-lg w-full max-w-md">
			<div class="flex items-center justify-between p-4 border-b">
				<h2 class="text-lg font-semibold">
					{editingTemplate ? 'Edit Template' : 'Tambah Template'}
				</h2>
				<button
					type="button"
					onclick={closeModal}
					class="p-2 hover:bg-secondary rounded-full"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				method="POST"
				action={editingTemplate ? '?/update' : '?/create'}
				use:enhance={handleSubmit}
				class="p-4 space-y-4"
			>
				{#if editingTemplate}
					<input type="hidden" name="id" value={editingTemplate.id} />
				{/if}

				<div class="space-y-2">
					<label for="name" class="text-sm font-medium">Nama Template</label>
					<input
						id="name"
						name="name"
						type="text"
						bind:value={name}
						placeholder="Contoh: Penjualan Tunai"
						class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="type" class="text-sm font-medium">Tipe Transaksi</label>
					<select
						id="type"
						name="type"
						bind:value={type}
						class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
						required
					>
						<option value="income">Pemasukan</option>
						<option value="expense">Pengeluaran</option>
					</select>
				</div>

				<div class="space-y-2">
					<label for="categoryId" class="text-sm font-medium">Kategori (Opsional)</label>
					<select
						id="categoryId"
						name="categoryId"
						bind:value={categoryId}
						class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
					>
						<option value="">Tanpa Kategori</option>
						{#each formCategories as cat (cat.id)}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-2">
					<label for="description" class="text-sm font-medium">Keterangan (Opsional)</label>
					<input
						id="description"
						name="description"
						type="text"
						bind:value={description}
						placeholder="Contoh: Penjualan makanan secara tunai"
						class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={closeModal}
						class="flex-1 py-3 border rounded-lg font-medium hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={loading}
						class="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
					>
						{loading ? 'Menyimpan...' : editingTemplate ? 'Perbarui' : 'Simpan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

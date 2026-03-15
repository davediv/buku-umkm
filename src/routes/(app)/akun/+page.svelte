<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		Wallet,
		Building2,
		Smartphone,
		Pencil,
		Trash2,
		Plus,
		X,
		ArrowLeftRight
	} from '@lucide/svelte';
	import { formatRupiah } from '$lib/utils';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State
	let showModal = $state(false);
	let editingAccount = $state<{ id: string; name: string; type: string } | null>(null);
	let loading = $state(false);
	let deletingId = $state<string | null>(null);

	// Transfer modal state
	let showTransferModal = $state(false);
	let transferLoading = $state(false);
	let transferError = $state<string | null>(null);
	let transferSuccess = $state<string | null>(null);

	// Transfer form data
	let sourceAccountId = $state('');
	let destinationAccountId = $state('');
	let transferAmount = $state(0);
	let transferDate = $state(new Date().toISOString().split('T')[0]);
	let transferDescription = $state('');

	// Form data
	let name = $state('');
	let type = $state<'cash' | 'bank' | 'ewallet'>('cash');
	let openingBalance = $state(0);

	// Derived
	let accounts = $derived(data.accounts);
	let totalBalance = $derived(accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0));

	// Helper to get icon by type
	function getIconByType(accountType: string) {
		switch (accountType) {
			case 'bank':
				return Building2;
			case 'ewallet':
				return Smartphone;
			default:
				return Wallet;
		}
	}

	// Helper to get label by type
	function getLabelByType(accountType: string): string {
		switch (accountType) {
			case 'bank':
				return 'Bank';
			case 'ewallet':
				return 'E-Wallet';
			default:
				return 'Tunai';
		}
	}

	// Open modal for creating new account
	function openCreateModal() {
		editingAccount = null;
		name = '';
		type = 'cash';
		openingBalance = 0;
		showModal = true;
	}

	// Open modal for editing
	function openEditModal(account: { id: string; name: string; type: string }) {
		editingAccount = account;
		name = account.name;
		type = account.type as 'cash' | 'bank' | 'ewallet';
		openingBalance = 0;
		showModal = true;
	}

	// Close modal
	function closeModal() {
		showModal = false;
		editingAccount = null;
		name = '';
		type = 'cash';
		openingBalance = 0;
	}

	// Open transfer modal
	function openTransferModal() {
		transferError = null;
		transferSuccess = null;
		sourceAccountId = accounts.length > 0 ? accounts[0].id : '';
		destinationAccountId =
			accounts.length > 1 ? accounts[1].id : accounts.length > 0 ? accounts[0].id : '';
		transferAmount = 0;
		transferDate = new Date().toISOString().split('T')[0];
		transferDescription = '';
		showTransferModal = true;
	}

	// Close transfer modal
	function closeTransferModal() {
		showTransferModal = false;
		transferError = null;
		transferSuccess = null;
		sourceAccountId = '';
		destinationAccountId = '';
		transferAmount = 0;
		transferDate = new Date().toISOString().split('T')[0];
		transferDescription = '';
	}

	// Validate transfer form
	function validateTransfer(): string | null {
		if (!sourceAccountId) {
			return 'Akun sumber wajib dipilih';
		}
		if (!destinationAccountId) {
			return 'Akun tujuan wajib dipilih';
		}
		if (sourceAccountId === destinationAccountId) {
			return 'Akun sumber dan tujuan tidak boleh sama';
		}
		if (transferAmount <= 0) {
			return 'Jumlah harus lebih dari 0';
		}
		if (!transferDate) {
			return 'Tanggal wajib diisi';
		}
		return null;
	}

	// Handle transfer submit
	async function handleTransferSubmit() {
		const validationError = validateTransfer();
		if (validationError) {
			transferError = validationError;
			return;
		}

		transferLoading = true;
		transferError = null;
		transferSuccess = null;

		try {
			const response = await fetch('/api/transfers', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					amount: transferAmount,
					source_account_id: sourceAccountId,
					destination_account_id: destinationAccountId,
					date: transferDate,
					description: transferDescription || undefined
				})
			});

			const result = (await response.json()) as { error?: string };

			if (!response.ok) {
				transferError = result.error ?? 'Gagal melakukan transfer';
				return;
			}

			transferSuccess = 'Transfer berhasil dibuat';
			setTimeout(() => {
				closeTransferModal();
				goto('/akun', { invalidateAll: true });
			}, 1500);
		} catch (error) {
			console.error('Error creating transfer:', error);
			transferError = 'Terjadi kesalahan server';
		} finally {
			transferLoading = false;
		}
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

	// Handle delete
	async function handleDelete(accountId: string) {
		if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) {
			return;
		}

		deletingId = accountId;
		try {
			const response = await fetch(`/api/accounts/${accountId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Reload the page to get updated data
				goto('/akun', { invalidateAll: true });
			} else {
				const resData = (await response.json()) as { error?: string };
				alert(resData.error || 'Gagal menghapus akun');
			}
		} catch (error) {
			console.error('Error deleting account:', error);
			alert('Terjadi kesalahan server');
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head>
	<title>Kelola Akun - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Kelola Akun</h1>
			<p class="text-sm text-muted-foreground">Kelola akun kas, bank, dan e-wallet Anda</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={openTransferModal}
				disabled={accounts.length < 2}
				class="inline-flex items-center justify-center gap-2 border border-input bg-background hover:bg-secondary px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<ArrowLeftRight class="w-4 h-4" />
				Transfer
			</button>
			<button
				onclick={openCreateModal}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Tambah Akun
			</button>
		</div>
	</div>

	<!-- Total Balance Card -->
	<div class="bg-card border rounded-lg p-4 md:p-6">
		<p class="text-sm text-muted-foreground mb-1">Total Saldo</p>
		<p class="text-3xl font-bold">{formatRupiah(totalBalance)}</p>
	</div>

	<!-- Error/Success Message -->
	{#if form?.error}
		<div
			class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md"
		>
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="bg-green-500/10 border border-green-500 text-green-500 text-sm p-3 rounded-md">
			{form.message}
		</div>
	{/if}

	<!-- Accounts List -->
	{#if accounts.length > 0}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each accounts as account (account.id)}
				{@const IconComponent = getIconByType(account.type)}
				<div class="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
								<IconComponent class="w-5 h-5 text-primary" />
							</div>
							<div>
								<h3 class="font-medium">{account.name}</h3>
								<p class="text-xs text-muted-foreground">{getLabelByType(account.type)}</p>
							</div>
						</div>
						<div class="flex gap-1">
							<button
								onclick={() => openEditModal(account)}
								class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
								aria-label="Edit akun"
							>
								<Pencil class="w-4 h-4" />
							</button>
							<button
								onclick={() => handleDelete(account.id)}
								disabled={deletingId === account.id}
								class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
								aria-label="Hapus akun"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					</div>
					<div class="mt-4 pt-4 border-t">
						<p class="text-sm text-muted-foreground">Saldo Saat Ini</p>
						<p class="text-xl font-semibold">{formatRupiah(account.balance || 0)}</p>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Empty State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
				<Wallet class="w-8 h-8 text-muted-foreground" />
			</div>
			<h3 class="text-lg font-medium mb-2">Belum ada akun</h3>
			<p class="text-sm text-muted-foreground mb-6 max-w-sm">
				Yuk, buat akun pertama Anda untuk mulai mencatat keuangan bisnis!
			</p>
			<button
				onclick={openCreateModal}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Tambah Akun
			</button>
		</div>
	{/if}
</div>

<!-- Transfer Modal -->
{#if showTransferModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="transfer-modal-title"
	>
		<div class="bg-white border rounded-lg shadow-xl w-full max-w-md p-6">
			<div class="flex items-center justify-between mb-6">
				<h2 id="transfer-modal-title" class="text-lg font-semibold">Transfer Antar Akun</h2>
				<button
					onclick={closeTransferModal}
					class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Error Message -->
			{#if transferError}
				<div
					class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md mb-4"
				>
					{transferError}
				</div>
			{/if}

			<!-- Success Message -->
			{#if transferSuccess}
				<div
					class="bg-green-500/10 border border-green-500 text-green-500 text-sm p-3 rounded-md mb-4"
				>
					{transferSuccess}
				</div>
			{/if}

			<div class="space-y-4">
				<!-- Source Account -->
				<div class="space-y-2">
					<label for="source_account" class="text-sm font-medium">Akun Sumber</label>
					<select
						id="source_account"
						bind:value={sourceAccountId}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="">Pilih akun sumber...</option>
						{#each accounts as account (account.id)}
							<option value={account.id}
								>{account.name} ({formatRupiah(account.balance || 0)})</option
							>
						{/each}
					</select>
				</div>

				<!-- Destination Account -->
				<div class="space-y-2">
					<label for="destination_account" class="text-sm font-medium">Akun Tujuan</label>
					<select
						id="destination_account"
						bind:value={destinationAccountId}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="">Pilih akun tujuan...</option>
						{#each accounts as account (account.id)}
							<option value={account.id}>{account.name}</option>
						{/each}
					</select>
					{#if sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId}
						<p class="text-xs text-destructive">Akun sumber dan tujuan tidak boleh sama</p>
					{/if}
				</div>

				<!-- Amount -->
				<div class="space-y-2">
					<label for="transfer_amount" class="text-sm font-medium">Jumlah (Rp)</label>
					<input
						id="transfer_amount"
						type="number"
						bind:value={transferAmount}
						min="1"
						step="100"
						placeholder="0"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>

				<!-- Date -->
				<div class="space-y-2">
					<label for="transfer_date" class="text-sm font-medium">Tanggal</label>
					<input
						id="transfer_date"
						type="date"
						bind:value={transferDate}
						max={new Date().toISOString().split('T')[0]}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>

				<!-- Description (Optional) -->
				<div class="space-y-2">
					<label for="transfer_description" class="text-sm font-medium">Keterangan (Opsional)</label
					>
					<input
						id="transfer_description"
						type="text"
						bind:value={transferDescription}
						placeholder="Contoh: Setoran modal ke bank"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					/>
				</div>

				<div class="flex gap-3 pt-4">
					<button
						type="button"
						onclick={closeTransferModal}
						class="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="button"
						onclick={handleTransferSubmit}
						disabled={transferLoading ||
							sourceAccountId === destinationAccountId ||
							!sourceAccountId ||
							!destinationAccountId ||
							transferAmount <= 0}
						class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{transferLoading ? 'Mengirim...' : 'Transfer'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal for Create/Edit Account -->
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
					{editingAccount ? 'Edit Akun' : 'Tambah Akun'}
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
				action={editingAccount ? '?/update' : '?/create'}
				use:enhance={handleSubmit}
				class="space-y-4"
			>
				{#if editingAccount}
					<input type="hidden" name="id" value={editingAccount.id} />
				{/if}

				<div class="space-y-2">
					<label for="name" class="text-sm font-medium">Nama Akun</label>
					<input
						id="name"
						name="name"
						type="text"
						bind:value={name}
						placeholder="Contoh: Kas Toko, Bank BCA, Dana"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="type" class="text-sm font-medium">Jenis Akun</label>
					<select
						id="type"
						name="type"
						bind:value={type}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<option value="cash">Tunai</option>
						<option value="bank">Bank</option>
						<option value="ewallet">E-Wallet</option>
					</select>
				</div>

				{#if !editingAccount}
					<div class="space-y-2">
						<label for="opening_balance" class="text-sm font-medium">Saldo Awal (Rp)</label>
						<input
							id="opening_balance"
							name="opening_balance"
							type="number"
							bind:value={openingBalance}
							min="0"
							step="100"
							placeholder="0"
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						/>
						<p class="text-xs text-muted-foreground">Saldo awal opsional. Kosongkan jika 0.</p>
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
						{loading ? 'Menyimpan...' : editingAccount ? 'Simpan Perubahan' : 'Buat Akun'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

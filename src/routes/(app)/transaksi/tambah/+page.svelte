<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Camera, Check, X } from '@lucide/svelte';
	import { formatIdr } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Form state
	let type = $state<'income' | 'expense'>('income');
	let amount = $state('');
	let categoryId = $state('');
	let accountId = $state('');
	let date = $state(new Date().toISOString().split('T')[0]);
	let description = $state('');
	let loading = $state(false);
	let showCategoryPicker = $state(false);
	let showAccountPicker = $state(false);

	// Derived
	let categories = $derived(type === 'income' ? data.categories.income : data.categories.expense);
	let selectedCategory = $derived(categories.find((c) => c.id === categoryId));
	let selectedAccount = $derived(data.accounts.find((a) => a.id === accountId));

	function handleAmountInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cursorPos = input.selectionStart || 0;
		const oldLength = amount.length;

		// Get just digits
		const digits = input.value.replace(/\D/g, '');
		amount = digits;

		// Adjust cursor position
		requestAnimationFrame(() => {
			const newLength = amount.length;
			const newPos = cursorPos + (newLength - oldLength);
			input.setSelectionRange(newPos, newPos);
		});
	}

	function handleAmountBlur() {
		if (amount) {
			amount = formatIdr(amount);
		}
	}

	function handleAmountFocus() {
		// Remove formatting on focus for easier editing
		amount = amount.replace(/\./g, '');
	}

	// Select category
	function selectCategory(cat: {
		id: string;
		name: string;
		icon?: string | null;
		color?: string | null;
	}) {
		categoryId = cat.id;
		showCategoryPicker = false;
	}

	// Select account
	function selectAccount(acc: { id: string; name: string; code: string }) {
		accountId = acc.id;
		showAccountPicker = false;
	}

	// Submit form
	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Validation
		if (!amount || parseInt(amount.replace(/\D/g, ''), 10) <= 0) {
			alert('Jumlah harus lebih dari 0');
			return;
		}

		if (!accountId) {
			alert('Pilih akun terlebih dahulu');
			return;
		}

		loading = true;

		try {
			const payload = {
				type,
				amount: parseInt(amount.replace(/\D/g, ''), 10),
				category_id: categoryId || undefined,
				account_id: accountId,
				date,
				description: description || undefined
			};

			const response = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = (await response.json()) as { error?: string };

			if (response.ok) {
				// Reset form for quick next entry
				amount = '';
				categoryId = '';
				date = new Date().toISOString().split('T')[0];
				description = '';

				// Show success feedback - navigate to transactions list
				goto('/transaksi?success=true');
			} else {
				alert(result.error || 'Gagal menyimpan transaksi');
			}
		} catch (error) {
			console.error('Error saving transaction:', error);
			alert('Terjadi kesalahan server');
		} finally {
			loading = false;
		}
	}

	// Quick amount buttons
	const quickAmounts = [10000, 25000, 50000, 100000, 200000, 500000];
</script>

<svelte:head>
	<title>Tambah Transaksi - Buku UMKM</title>
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
		<h1 class="text-lg font-semibold">Tambah Transaksi</h1>
	</header>

	<!-- Main Form -->
	<form onsubmit={handleSubmit} class="flex-1 flex flex-col p-4 space-y-6">
		<!-- Type Toggle -->
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => {
					type = 'income';
					categoryId = ''; // Reset category when switching type
				}}
				class="flex-1 py-3 rounded-lg font-medium transition-all {type === 'income'
					? 'bg-green-500 text-white'
					: 'bg-muted text-muted-foreground hover:bg-secondary'}"
			>
				Pemasukan
			</button>
			<button
				type="button"
				onclick={() => {
					type = 'expense';
					categoryId = ''; // Reset category when switching type
				}}
				class="flex-1 py-3 rounded-lg font-medium transition-all {type === 'expense'
					? 'bg-red-500 text-white'
					: 'bg-muted text-muted-foreground hover:bg-secondary'}"
			>
				Pengeluaran
			</button>
		</div>

		<!-- Amount Input -->
		<div class="space-y-2">
			<label for="amount" class="text-sm font-medium text-muted-foreground">Jumlah</label>
			<div class="relative">
				<span
					class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-medium text-muted-foreground"
				>
					Rp
				</span>
				<input
					id="amount"
					type="text"
					inputmode="numeric"
					bind:value={amount}
					oninput={handleAmountInput}
					onblur={handleAmountBlur}
					onfocus={handleAmountFocus}
					placeholder="0"
					class="w-full text-4xl font-bold py-4 pl-16 pr-4 bg-muted rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-primary"
					required
				/>
			</div>

			<!-- Quick Amount Buttons -->
			<div class="flex flex-wrap gap-2 pt-2">
				{#each quickAmounts as quickAmt (quickAmt)}
					<button
						type="button"
						onclick={() => {
							amount = quickAmt.toString();
						}}
						class="px-3 py-1.5 text-sm bg-muted hover:bg-secondary rounded-full transition-colors"
					>
						+{quickAmt.toLocaleString('id-ID')}
					</button>
				{/each}
			</div>
		</div>

		<!-- Category Picker -->
		<div class="space-y-2">
			<label for="category" class="text-sm font-medium text-muted-foreground">Kategori</label>
			<button
				type="button"
				onclick={() => (showCategoryPicker = true)}
				class="w-full flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-secondary transition-colors text-left"
			>
				{#if selectedCategory}
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center text-white text-lg"
						style="background-color: {selectedCategory.color || '#6b7280'}"
					>
						{selectedCategory.icon || '📁'}
					</div>
					<span class="flex-1 font-medium">{selectedCategory.name}</span>
				{:else}
					<div
						class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
					>
						?
					</div>
					<span class="flex-1 text-muted-foreground">Pilih kategori</span>
				{/if}
			</button>
		</div>

		<!-- Account Picker -->
		<div class="space-y-2">
			<label for="account" class="text-sm font-medium text-muted-foreground">Akun</label>
			<button
				type="button"
				onclick={() => (showAccountPicker = true)}
				class="w-full flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-secondary transition-colors text-left"
			>
				{#if selectedAccount}
					<div
						class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
					>
						💳
					</div>
					<div class="flex-1">
						<div class="font-medium">{selectedAccount.name}</div>
						<div class="text-xs text-muted-foreground">Kode: {selectedAccount.code}</div>
					</div>
				{:else}
					<div
						class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
					>
						?
					</div>
					<span class="flex-1 text-muted-foreground">Pilih akun</span>
				{/if}
			</button>
		</div>

		<!-- Date Picker -->
		<div class="space-y-2">
			<label for="date" class="text-sm font-medium text-muted-foreground">Tanggal</label>
			<input
				id="date"
				type="date"
				bind:value={date}
				max={new Date().toISOString().split('T')[0]}
				class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
				required
			/>
		</div>

		<!-- Description -->
		<div class="space-y-2">
			<label for="description" class="text-sm font-medium text-muted-foreground">
				Keterangan <span class="text-muted-foreground font-normal">(opsional)</span>
			</label>
			<input
				id="description"
				type="text"
				bind:value={description}
				placeholder="Contoh: Makan siang diwarung"
				class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
			/>
		</div>

		<!-- Receipt Photo Button -->
		<button
			type="button"
			class="flex items-center gap-2 p-3 border border-dashed rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
		>
			<Camera class="w-5 h-5" />
			<span>Tambah foto nota</span>
		</button>

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Submit Button -->
		<button
			type="submit"
			disabled={loading}
			class="w-full py-4 bg-primary text-primary-foreground text-lg font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
		>
			{loading ? 'Menyimpan...' : 'Simpan'}
		</button>
	</form>
</div>

<!-- Category Picker Modal -->
{#if showCategoryPicker}
	<div class="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
		<header
			class="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between"
		>
			<h2 class="text-lg font-semibold">Pilih Kategori</h2>
			<button
				onclick={() => (showCategoryPicker = false)}
				class="p-2 hover:bg-secondary rounded-full"
				aria-label="Tutup"
			>
				<X class="w-5 h-5" />
			</button>
		</header>

		<div class="flex-1 overflow-y-auto p-4">
			{#if categories.length > 0}
				<div class="grid grid-cols-3 gap-3">
					{#each categories as cat (cat.id)}
						<button
							type="button"
							onclick={() => selectCategory(cat)}
							class="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-secondary transition-colors {categoryId ===
							cat.id
								? 'bg-primary/10 ring-2 ring-primary'
								: ''}"
						>
							<div
								class="w-12 h-12 rounded-full flex items-center justify-center text-xl"
								style="background-color: {cat.color || '#6b7280'}"
							>
								{cat.icon || '📁'}
							</div>
							<span class="text-xs text-center font-medium line-clamp-2">{cat.name}</span>
						</button>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<p class="text-muted-foreground mb-4">
						Belum ada kategori untuk {type === 'income' ? 'pemasukan' : 'pengeluaran'}
					</p>
					<a href="/kategori" class="text-primary hover:underline">Tambah kategori</a>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Account Picker Modal -->
{#if showAccountPicker}
	<div class="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
		<header
			class="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between"
		>
			<h2 class="text-lg font-semibold">Pilih Akun</h2>
			<button
				onclick={() => (showAccountPicker = false)}
				class="p-2 hover:bg-secondary rounded-full"
				aria-label="Tutup"
			>
				<X class="w-5 h-5" />
			</button>
		</header>

		<div class="flex-1 overflow-y-auto p-4">
			{#if data.accounts.length > 0}
				<div class="space-y-2">
					{#each data.accounts as acc (acc.id)}
						<button
							type="button"
							onclick={() => selectAccount(acc)}
							class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left {accountId ===
							acc.id
								? 'bg-primary/10 ring-2 ring-primary'
								: ''}"
						>
							<div
								class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
							>
								💳
							</div>
							<div class="flex-1">
								<div class="font-medium">{acc.name}</div>
								<div class="text-xs text-muted-foreground">Kode: {acc.code}</div>
							</div>
							{#if accountId === acc.id}
								<Check class="w-5 h-5 text-primary" />
							{/if}
						</button>
					{/each}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<p class="text-muted-foreground mb-4">Belum ada akun</p>
					<a href="/akun" class="text-primary hover:underline">Tambah akun</a>
				</div>
			{/if}
		</div>
	</div>
{/if}

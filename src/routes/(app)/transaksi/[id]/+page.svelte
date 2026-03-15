<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Check, X, Trash2, Camera, Image } from '@lucide/svelte';
	import { formatIdr, compressImage } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// If there's an error, show message
	let error = $derived(data.error);

	// Form state
	let type = $state<'income' | 'expense'>(
		(data.transaction?.type as 'income' | 'expense') || 'expense'
	);
	let amount = $state(data.transaction?.amount?.toString() || '');
	let categoryId = $state(data.transaction?.categoryId || '');
	let accountId = $state(data.transaction?.accountId || '');
	let date = $state(data.transaction?.date || '');
	let description = $state(data.transaction?.description || '');
	let referenceNumber = $state(data.transaction?.referenceNumber || '');
	let notes = $state(data.transaction?.notes || '');
	let loading = $state(false);
	let deleting = $state(false);
	let showCategoryPicker = $state(false);
	let showAccountPicker = $state(false);
	let showDeleteConfirm = $state(false);

	// Photo state
	let photos = $state(data.photos || []);
	let showPhotoSourceMenu = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let showPhotoViewer = $state(false);
	let selectedPhotoIndex = $state(0);
	let showRemovePhotoConfirm = $state(false);
	let photoToRemove = $state<string | null>(null);

	const MAX_PHOTOS = 3;

	// Derived
	let photoCount = $derived(photos.length);
	let canAddPhoto = $derived(photos.length < MAX_PHOTOS);

	// Handle file selection
	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		const file = input.files[0];

		if (!['image/jpeg', 'image/png'].includes(file.type)) {
			alert('Format file harus JPEG atau PNG');
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			alert('Ukuran file maksimal adalah 5MB');
			return;
		}

		try {
			const compressed = await compressImage(file);
			const formData = new FormData();
			formData.append('file', compressed);

			const response = await fetch(`/api/transactions/${data.transaction?.id}/photos`, {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = (await response.json()) as { photo?: { id: string; r2Url: string } };
				if (result.photo) {
					photos = [...photos, result.photo] as typeof photos;
				}
			} else {
				const result = (await response.json()) as { error?: string };
				alert(result.error || 'Gagal mengunggah foto');
			}
		} catch (error) {
			console.error('Error uploading photo:', error);
			alert('Terjadi kesalahan server');
		} finally {
			showPhotoSourceMenu = false;
			input.value = '';
		}
	}

	// Open camera
	function openCamera() {
		if (fileInputRef) {
			fileInputRef.setAttribute('capture', 'environment');
			fileInputRef.click();
		}
	}

	// Open gallery
	function openGallery() {
		if (fileInputRef) {
			fileInputRef.removeAttribute('capture');
			fileInputRef.click();
		}
	}

	// View photo
	function viewPhoto(index: number) {
		selectedPhotoIndex = index;
		showPhotoViewer = true;
	}

	// Remove photo
	async function confirmRemovePhoto(photoId: string) {
		photoToRemove = photoId;
		showRemovePhotoConfirm = true;
	}

	async function removePhoto() {
		if (!photoToRemove) return;

		try {
			const response = await fetch(
				`/api/transactions/${data.transaction?.id}/photos/${photoToRemove}`,
				{
					method: 'DELETE'
				}
			);

			if (response.ok) {
				photos = photos.filter((p) => p.id !== photoToRemove);
			} else {
				const result = (await response.json()) as { error?: string };
				alert(result.error || 'Gagal menghapus foto');
			}
		} catch (error) {
			console.error('Error removing photo:', error);
			alert('Terjadi kesalahan server');
		} finally {
			showRemovePhotoConfirm = false;
			photoToRemove = null;
		}
	}

	// Derived
	let categories = $derived(
		type === 'income' ? data.categories?.income || [] : data.categories?.expense || []
	);
	let selectedCategory = $derived(categories.find((c) => c.id === categoryId));
	let selectedAccount = $derived((data.accounts || []).find((a) => a.id === accountId));

	function handleAmountInput(e: Event) {
		const input = e.target as HTMLInputElement;
		amount = input.value.replace(/\D/g, '');
	}

	function handleAmountBlur() {
		if (amount) {
			amount = formatIdr(amount);
		}
	}

	function handleAmountFocus() {
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
				amount: parseInt(amount.replace(/\D/g, ''), 10),
				category_id: categoryId || undefined,
				date,
				description: description || undefined,
				reference_number: referenceNumber || undefined,
				notes: notes || undefined
			};

			const response = await fetch(`/api/transactions/${data.transaction?.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = (await response.json()) as { error?: string };

			if (response.ok) {
				goto('/transaksi?success=updated');
			} else {
				alert(result.error || 'Gagal memperbarui transaksi');
			}
		} catch (error) {
			console.error('Error updating transaction:', error);
			alert('Terjadi kesalahan server');
		} finally {
			loading = false;
		}
	}

	// Delete transaction
	async function handleDelete() {
		deleting = true;
		try {
			const response = await fetch(`/api/transactions/${data.transaction?.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				goto('/transaksi?success=deleted');
			} else {
				const result = (await response.json()) as { error?: string };
				alert(result.error || 'Gagal menghapus transaksi');
			}
		} catch (error) {
			console.error('Error deleting transaction:', error);
			alert('Terjadi kesalahan server');
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}
</script>

<svelte:head>
	<title>Edit Transaksi - Buku UMKM</title>
</svelte:head>

{#if error}
	<div class="min-h-screen bg-background flex flex-col">
		<header class="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
			<a
				href="/transaksi"
				class="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
				aria-label="Kembali"
			>
				<ArrowLeft class="w-5 h-5" />
			</a>
			<h1 class="text-lg font-semibold">Transaksi</h1>
		</header>
		<div class="flex-1 flex items-center justify-center p-4">
			<div class="text-center">
				<p class="text-destructive mb-4">{error}</p>
				<a href="/transaksi" class="text-primary hover:underline">Kembali ke daftar transaksi</a>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-background flex flex-col">
		<!-- Header -->
		<header
			class="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between"
		>
			<div class="flex items-center gap-3">
				<a
					href="/transaksi"
					class="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
					aria-label="Kembali"
				>
					<ArrowLeft class="w-5 h-5" />
				</a>
				<h1 class="text-lg font-semibold">Edit Transaksi</h1>
			</div>
			<button
				onclick={() => (showDeleteConfirm = true)}
				class="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors"
				aria-label="Hapus transaksi"
			>
				<Trash2 class="w-5 h-5" />
			</button>
		</header>

		<!-- Main Form -->
		<form onsubmit={handleSubmit} class="flex-1 flex flex-col p-4 space-y-4">
			<!-- Type Toggle (read-only since changing type would affect balance incorrectly) -->
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => (type = 'income')}
					class="flex-1 py-3 rounded-lg font-medium transition-all {type === 'income'
						? 'bg-green-500 text-white'
						: 'bg-muted text-muted-foreground hover:bg-secondary'}"
				>
					Pemasukan
				</button>
				<button
					type="button"
					onclick={() => (type = 'expense')}
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
						class="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-muted-foreground"
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
						class="w-full text-2xl font-bold py-3 pl-14 pr-4 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
						required
					/>
				</div>
			</div>

			<!-- Category Picker -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-muted-foreground">Kategori</label>
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
						<span class="flex-1 text-muted-foreground">Pilih kategori</span>
					{/if}
				</button>
			</div>

			<!-- Account Picker -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-muted-foreground">Akun</label>
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
						<span class="flex-1 text-muted-foreground">Pilih akun</span>
					{/if}
				</button>
			</div>

			<!-- Date -->
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

			<!-- Reference Number -->
			<div class="space-y-2">
				<label for="referenceNumber" class="text-sm font-medium text-muted-foreground">
					Nomor Referensi <span class="text-muted-foreground font-normal">(opsional)</span>
				</label>
				<input
					id="referenceNumber"
					type="text"
					bind:value={referenceNumber}
					placeholder="Contoh: INV/001"
					class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>

			<!-- Notes -->
			<div class="space-y-2">
				<label for="notes" class="text-sm font-medium text-muted-foreground">
					Catatan <span class="text-muted-foreground font-normal">(opsional)</span>
				</label>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Catatan tambahan..."
					rows="2"
					class="w-full p-3 bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
				></textarea>
			</div>

			<!-- Photos -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label class="text-sm font-medium text-muted-foreground">Foto Nota</label>
					{#if canAddPhoto}
						<button
							type="button"
							onclick={() => (showPhotoSourceMenu = true)}
							class="text-sm text-primary hover:underline flex items-center gap-1"
						>
							<Camera class="w-4 h-4" />
							Tambah
						</button>
					{/if}
				</div>

				{#if photos.length > 0}
					<div class="text-xs text-muted-foreground mb-2">
						{photoCount}/{MAX_PHOTOS} foto
					</div>
					<div class="flex gap-2 flex-wrap">
						{#each photos as photo, index (photo.id)}
							<div class="relative group">
								<button type="button" onclick={() => viewPhoto(index)}>
									<img
										src={photo.r2Url}
										alt="Foto nota"
										class="w-20 h-20 object-cover rounded-lg border"
									/>
								</button>
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										confirmRemovePhoto(photo.id);
									}}
									class="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
									aria-label="Hapus foto"
								>
									<Trash2 class="w-3 h-3" />
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (showPhotoSourceMenu = true)}
						class="w-full flex items-center justify-center gap-2 p-4 border border-dashed rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
					>
						<Image class="w-5 h-5" />
						<span>Tambah foto nota</span>
					</button>
				{/if}

				<!-- Hidden file input -->
				<input
					bind:this={fileInputRef}
					type="file"
					accept="image/jpeg,image/png"
					onchange={handleFileSelect}
					class="hidden"
				/>
			</div>

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={loading}
				class="w-full py-3 bg-primary text-primary-foreground text-base font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
			>
				{loading ? 'Menyimpan...' : 'Simpan Perubahan'}
			</button>
		</form>
	</div>
{/if}

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
					<p class="text-muted-foreground mb-4">Belum ada kategori</p>
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
			{#if data.accounts?.length}
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

<!-- Photo Source Menu -->
{#if showPhotoSourceMenu}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white border rounded-lg shadow-xl w-full max-w-sm p-6">
			<h2 class="text-lg font-semibold mb-4">Pilih Sumber Foto</h2>
			<div class="space-y-3">
				<button
					type="button"
					onclick={openCamera}
					class="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-secondary transition-colors"
				>
					<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
						<Camera class="w-5 h-5 text-primary" />
					</div>
					<div class="text-left">
						<div class="font-medium">Kamera</div>
						<div class="text-xs text-muted-foreground">Ambil foto langsung</div>
					</div>
				</button>
				<button
					type="button"
					onclick={openGallery}
					class="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-secondary transition-colors"
				>
					<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
						<Image class="w-5 h-5 text-primary" />
					</div>
					<div class="text-left">
						<div class="font-medium">Galeri</div>
						<div class="text-xs text-muted-foreground">Pilih dari galeri</div>
					</div>
				</button>
			</div>
			<button
				type="button"
				onclick={() => (showPhotoSourceMenu = false)}
				class="w-full mt-4 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				Batal
			</button>
		</div>
	</div>
{/if}

<!-- Photo Viewer -->
{#if showPhotoViewer}
	<div
		class="fixed inset-0 z-50 bg-black flex items-center justify-center"
		role="dialog"
		aria-modal="true"
	>
		<button
			onclick={() => (showPhotoViewer = false)}
			class="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full z-10"
			aria-label="Tutup"
		>
			<X class="w-6 h-6" />
		</button>

		{#if photos.length > 1}
			<button
				onclick={() =>
					(selectedPhotoIndex = (selectedPhotoIndex - 1 + photos.length) % photos.length)}
				class="absolute left-4 p-2 text-white hover:bg-white/10 rounded-full"
				aria-label="Foto sebelumnya"
			>
				<ArrowLeft class="w-6 h-6" />
			</button>
			<button
				onclick={() => (selectedPhotoIndex = (selectedPhotoIndex + 1) % photos.length)}
				class="absolute right-4 p-2 text-white hover:bg-white/10 rounded-full"
				aria-label="Foto berikutnya"
			>
				<ArrowLeft class="w-6 h-6 rotate-180" />
			</button>
		{/if}

		<img
			src={photos[selectedPhotoIndex]?.r2Url}
			alt="Foto nota"
			class="max-w-full max-h-full object-contain"
		/>

		<div class="absolute bottom-4 text-white text-sm">
			{selectedPhotoIndex + 1} / {photos.length}
		</div>
	</div>
{/if}

<!-- Remove Photo Confirmation -->
{#if showRemovePhotoConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white border rounded-lg shadow-xl w-full max-w-md p-6">
			<h2 class="text-lg font-semibold mb-2">Hapus Foto?</h2>
			<p class="text-sm text-muted-foreground mb-6">
				Foto yang dihapus tidak dapat dikembalikan. Apakah Anda yakin?
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (showRemovePhotoConfirm = false)}
					class="flex-1 px-4 py-3 min-h-[48px] border rounded-md text-base font-medium hover:bg-secondary transition-colors"
				>
					Batal
				</button>
				<button
					onclick={removePhoto}
					class="flex-1 px-4 py-3 min-h-[48px] bg-destructive text-destructive-foreground rounded-md text-base font-medium hover:bg-destructive/90 transition-colors"
				>
					Hapus
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white border rounded-lg shadow-xl w-full max-w-md p-6">
			<h2 class="text-lg font-semibold mb-2">Hapus Transaksi?</h2>
			<p class="text-sm text-muted-foreground mb-6">
				Transaksi yang dihapus tidak dapat dikembalikan. Apakah Anda yakin ingin melanjutkan?
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (showDeleteConfirm = false)}
					class="flex-1 px-4 py-3 min-h-[48px] border rounded-md text-base font-medium hover:bg-secondary transition-colors"
				>
					Batal
				</button>
				<button
					onclick={handleDelete}
					disabled={deleting}
					class="flex-1 px-4 py-3 min-h-[48px] bg-destructive text-destructive-foreground rounded-md text-base font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
				>
					{deleting ? 'Menghapus...' : 'Hapus'}
				</button>
			</div>
		</div>
	</div>
{/if}

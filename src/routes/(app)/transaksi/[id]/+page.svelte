<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Camera, Image, Trash2, X } from '@lucide/svelte';
	import TransactionForm from '$lib/components/transactions/transaction-form.svelte';
	import { validateTransactionForm } from '$lib/client/transaction-form';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogDescription,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { toast } from '$lib/components/ui/toast';
	import { compressImage } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
	let showDeleteConfirm = $state(false);

	let photos = $state(data.photos || []);
	let showPhotoSourceMenu = $state(false);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let showPhotoViewer = $state(false);
	let selectedPhotoIndex = $state(0);
	let showRemovePhotoConfirm = $state(false);
	let photoToRemove = $state<string | null>(null);
	let uploadingPhoto = $state(false);

	const MAX_PHOTOS = 3;
	let categories = $derived(data.categories ?? { income: [], expense: [] });
	let accounts = $derived(data.accounts ?? []);
	let canAddPhoto = $derived(photos.length < MAX_PHOTOS);
	let transactionId = $derived(data.transaction?.id ?? '');

	async function handleFileSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !transactionId) return;

		if (!['image/jpeg', 'image/png'].includes(file.type)) {
			toast.error('Format file harus JPEG atau PNG');
			input.value = '';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error('Ukuran file maksimal adalah 5 MB');
			input.value = '';
			return;
		}

		uploadingPhoto = true;
		try {
			const formData = new FormData();
			formData.append('file', await compressImage(file));
			const response = await fetch(`/api/transactions/${transactionId}/photos`, {
				method: 'POST',
				body: formData
			});
			const result = (await response.json()) as {
				error?: string;
				photo?: { id: string; r2Url: string };
			};
			if (!response.ok || !result.photo) {
				throw new Error(result.error || 'Gagal mengunggah foto');
			}
			photos = [...photos, result.photo] as typeof photos;
			toast.success('Foto nota berhasil diunggah');
		} catch (uploadError) {
			console.error('Error uploading receipt:', uploadError);
			toast.error(uploadError instanceof Error ? uploadError.message : 'Terjadi kesalahan server');
		} finally {
			uploadingPhoto = false;
			showPhotoSourceMenu = false;
			input.value = '';
		}
	}

	function openCamera() {
		fileInputRef?.setAttribute('capture', 'environment');
		fileInputRef?.click();
	}

	function openGallery() {
		fileInputRef?.removeAttribute('capture');
		fileInputRef?.click();
	}

	function viewPhoto(index: number) {
		selectedPhotoIndex = index;
		showPhotoViewer = true;
	}

	function confirmRemovePhoto(photoId: string) {
		photoToRemove = photoId;
		showRemovePhotoConfirm = true;
	}

	async function removePhoto() {
		if (!photoToRemove || !transactionId) return;
		try {
			const response = await fetch(`/api/transactions/${transactionId}/photos/${photoToRemove}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				const result = (await response.json()) as { error?: string };
				throw new Error(result.error || 'Gagal menghapus foto');
			}
			photos = photos.filter((photo) => photo.id !== photoToRemove);
			toast.success('Foto nota dihapus');
		} catch (removeError) {
			console.error('Error removing receipt:', removeError);
			toast.error(removeError instanceof Error ? removeError.message : 'Terjadi kesalahan server');
		} finally {
			showRemovePhotoConfirm = false;
			photoToRemove = null;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const validation = validateTransactionForm({ amount, accountId, date });
		if (!validation.valid) {
			toast.warning(validation.message);
			return;
		}
		if (!transactionId) return;

		loading = true;
		try {
			const response = await fetch(`/api/transactions/${transactionId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount: validation.amount,
					category_id: categoryId || undefined,
					date,
					description: description || undefined,
					reference_number: referenceNumber || undefined,
					notes: notes || undefined
				})
			});
			const result = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(result.error || 'Gagal memperbarui transaksi');
			await goto('/transaksi?success=updated');
		} catch (updateError) {
			console.error('Error updating transaction:', updateError);
			toast.error(updateError instanceof Error ? updateError.message : 'Terjadi kesalahan server');
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!transactionId) return;
		deleting = true;
		try {
			const response = await fetch(`/api/transactions/${transactionId}`, { method: 'DELETE' });
			if (!response.ok) {
				const result = (await response.json()) as { error?: string };
				throw new Error(result.error || 'Gagal menghapus transaksi');
			}
			await goto('/transaksi?success=deleted');
		} catch (deleteError) {
			console.error('Error deleting transaction:', deleteError);
			toast.error(deleteError instanceof Error ? deleteError.message : 'Terjadi kesalahan server');
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}
</script>

<svelte:head>
	<title>Edit Transaksi - Buku UMKM</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3"
	>
		<div class="flex items-center gap-3">
			<a
				href="/transaksi"
				class="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
				aria-label="Kembali ke daftar transaksi"><ArrowLeft class="h-5 w-5" /></a
			>
			<h1 class="text-lg font-semibold">Edit Transaksi</h1>
		</div>
		<button
			type="button"
			onclick={() => (showDeleteConfirm = true)}
			class="flex h-11 w-11 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
			aria-label="Hapus transaksi"><Trash2 class="h-5 w-5" /></button
		>
	</header>

	{#snippet receiptFields()}
		<section class="space-y-2" aria-labelledby="stored-receipt-title">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h2 id="stored-receipt-title" class="text-sm font-medium text-muted-foreground">
						Foto nota <span class="font-normal">(opsional)</span>
					</h2>
					{#if photos.length > 0}<p class="text-xs text-muted-foreground">
							{photos.length}/{MAX_PHOTOS} foto
						</p>{/if}
				</div>
				{#if canAddPhoto}<button
						type="button"
						onclick={() => (showPhotoSourceMenu = true)}
						disabled={uploadingPhoto}
						class="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50"
						><Camera class="h-4 w-4" />{uploadingPhoto ? 'Mengunggah…' : 'Tambah'}</button
					>{/if}
			</div>
			{#if photos.length > 0}
				<div class="flex flex-wrap gap-3">
					{#each photos as photo, index (photo.id)}
						<div class="group relative">
							<button
								type="button"
								onclick={() => viewPhoto(index)}
								class="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								><img
									src={photo.r2Url}
									alt={`Foto nota ${index + 1}`}
									class="h-20 w-20 rounded-lg border object-cover"
								/></button
							>
							<button
								type="button"
								onclick={() => confirmRemovePhoto(photo.id)}
								class="absolute -right-2 -top-2 flex min-h-8 min-w-8 items-center justify-center rounded-full bg-destructive text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
								aria-label={`Hapus foto nota ${index + 1}`}><Trash2 class="h-4 w-4" /></button
							>
						</div>
					{/each}
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (showPhotoSourceMenu = true)}
					disabled={uploadingPhoto}
					class="flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
					><Image class="h-5 w-5" />{uploadingPhoto
						? 'Mengunggah foto…'
						: 'Tambah foto nota'}</button
				>
			{/if}
			<input
				bind:this={fileInputRef}
				type="file"
				accept="image/jpeg,image/png"
				onchange={handleFileSelect}
				class="hidden"
				aria-label="Pilih file foto nota"
			/>
		</section>
	{/snippet}

	<TransactionForm
		formId="edit-transaction"
		mode="edit"
		bind:type
		bind:amount
		bind:categoryId
		bind:accountId
		bind:date
		bind:description
		bind:referenceNumber
		bind:notes
		categoriesByType={categories}
		{accounts}
		returnTo={`/transaksi/${transactionId}`}
		busy={loading}
		submitLabel="Simpan perubahan"
		onsubmit={handleSubmit}
		attachments={receiptFields}
	/>
</div>

{#if showPhotoSourceMenu}
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="photo-source-title"
		tabindex="-1"
		onclick={(event) => event.target === event.currentTarget && (showPhotoSourceMenu = false)}
		onkeydown={(event) => event.key === 'Escape' && (showPhotoSourceMenu = false)}
	>
		<div class="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
			<h2 id="photo-source-title" class="mb-4 text-lg font-semibold">Pilih sumber foto</h2>
			<div class="space-y-3">
				<button
					type="button"
					onclick={openCamera}
					class="flex min-h-16 w-full items-center gap-3 rounded-lg border p-4 text-left hover:bg-secondary"
					><Camera class="h-5 w-5 text-primary" /><span
						><span class="block font-medium">Kamera</span><span
							class="block text-xs text-muted-foreground">Ambil foto langsung</span
						></span
					></button
				>
				<button
					type="button"
					onclick={openGallery}
					class="flex min-h-16 w-full items-center gap-3 rounded-lg border p-4 text-left hover:bg-secondary"
					><Image class="h-5 w-5 text-primary" /><span
						><span class="block font-medium">Galeri</span><span
							class="block text-xs text-muted-foreground">Pilih dari galeri</span
						></span
					></button
				>
			</div>
			<button
				type="button"
				onclick={() => (showPhotoSourceMenu = false)}
				class="mt-4 min-h-11 w-full text-sm text-muted-foreground hover:text-foreground"
				>Batal</button
			>
		</div>
	</div>
{/if}

{#if showPhotoViewer && photos[selectedPhotoIndex]}
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black"
		role="dialog"
		aria-modal="true"
		aria-label="Lihat foto nota"
		tabindex="-1"
		onkeydown={(event) => event.key === 'Escape' && (showPhotoViewer = false)}
	>
		<button
			type="button"
			onclick={() => (showPhotoViewer = false)}
			class="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
			aria-label="Tutup"><X class="h-6 w-6" /></button
		>
		{#if photos.length > 1}
			<button
				type="button"
				onclick={() =>
					(selectedPhotoIndex = (selectedPhotoIndex - 1 + photos.length) % photos.length)}
				class="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
				aria-label="Foto sebelumnya"><ArrowLeft class="h-6 w-6" /></button
			>
			<button
				type="button"
				onclick={() => (selectedPhotoIndex = (selectedPhotoIndex + 1) % photos.length)}
				class="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
				aria-label="Foto berikutnya"><ArrowLeft class="h-6 w-6 rotate-180" /></button
			>
		{/if}
		<img
			src={photos[selectedPhotoIndex].r2Url}
			alt={`Foto nota ${selectedPhotoIndex + 1}`}
			class="max-h-full max-w-full object-contain"
		/>
		<p class="absolute bottom-4 text-sm text-white">{selectedPhotoIndex + 1} / {photos.length}</p>
	</div>
{/if}

<AlertDialog
	open={showRemovePhotoConfirm}
	onopenchange={(open) => !open && ((showRemovePhotoConfirm = false), (photoToRemove = null))}
>
	<AlertDialogTitle>Hapus foto?</AlertDialogTitle>
	<AlertDialogDescription>Foto yang dihapus tidak dapat dikembalikan.</AlertDialogDescription>
	<div class="mt-6 flex gap-3">
		<AlertDialogCancel onclick={() => ((showRemovePhotoConfirm = false), (photoToRemove = null))}
			>Batal</AlertDialogCancel
		>
		<AlertDialogAction onclick={removePhoto}>Hapus</AlertDialogAction>
	</div>
</AlertDialog>

<AlertDialog open={showDeleteConfirm} onopenchange={(open) => !open && (showDeleteConfirm = false)}>
	<AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
	<AlertDialogDescription
		>Transaksi dan perubahan saldonya akan dibatalkan. Tindakan ini tidak dapat dikembalikan.</AlertDialogDescription
	>
	<div class="mt-6 flex gap-3">
		<AlertDialogCancel onclick={() => (showDeleteConfirm = false)}>Batal</AlertDialogCancel>
		<AlertDialogAction onclick={handleDelete} loading={deleting}
			>{deleting ? 'Menghapus…' : 'Hapus'}</AlertDialogAction
		>
	</div>
</AlertDialog>

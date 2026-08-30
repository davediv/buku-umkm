<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Image, Trash2 } from '@lucide/svelte';
	import { uploadAttachments } from '$lib/client/transaction-attachments';
	import {
		clearTransactionDraft,
		loadTransactionDraft,
		saveTransactionDraft
	} from '$lib/client/transaction-draft';
	import { validateTransactionForm } from '$lib/client/transaction-form';
	import TransactionForm from '$lib/components/transactions/transaction-form.svelte';
	import { toast } from '$lib/components/ui/toast';
	import { todayInJakarta } from '$lib/shared/dates';
	import { compressImage } from '$lib/utils';
	import type { PageData } from './$types';

	type PendingPhoto = {
		id: string;
		file: File;
		preview: string;
		error?: string;
	};

	let { data }: { data: PageData } = $props();

	let type = $state<'income' | 'expense'>('income');
	let amount = $state('');
	let categoryId = $state('');
	let accountId = $state('');
	let date = $state(todayInJakarta());
	let description = $state('');
	let referenceNumber = $state('');
	let notes = $state('');
	let commandId = $state('');
	let loading = $state(false);
	let uploading = $state(false);
	let draftReady = $state(false);
	let draftRestored = $state(false);
	let savedTransactionId = $state<string | null>(null);

	let photos = $state<PendingPhoto[]>([]);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let showPhotoSourceMenu = $state(false);

	const MAX_PHOTOS = 3;
	let canAddPhoto = $derived(photos.length < MAX_PHOTOS);

	function currentDraft() {
		return {
			commandId,
			type,
			amount,
			categoryId,
			accountId,
			date,
			description,
			referenceNumber,
			notes
		};
	}

	beforeNavigate(() => {
		if (draftReady && !savedTransactionId) saveTransactionDraft(currentDraft());
	});

	onMount(() => {
		const draft = loadTransactionDraft();
		if (draft) {
			const availableCategories =
				draft.type === 'income' ? data.categories.income : data.categories.expense;
			commandId = draft.commandId;
			type = draft.type;
			amount = draft.amount;
			categoryId = availableCategories.some((item) => item.id === draft.categoryId)
				? draft.categoryId
				: '';
			accountId = data.accounts.some((item) => item.id === draft.accountId) ? draft.accountId : '';
			date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : date;
			description = draft.description;
			referenceNumber = draft.referenceNumber;
			notes = draft.notes;
			draftRestored = true;
		}
		if (!commandId) commandId = crypto.randomUUID();
		draftReady = true;
	});

	$effect(() => {
		const draft = currentDraft();
		if (!draftReady || savedTransactionId) return;

		const timeout = window.setTimeout(() => saveTransactionDraft(draft), 250);
		return () => window.clearTimeout(timeout);
	});

	async function handleFileSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

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

		try {
			const compressed = await compressImage(file);
			photos = [
				...photos,
				{
					id: crypto.randomUUID(),
					file: compressed,
					preview: URL.createObjectURL(compressed)
				}
			];
		} catch (error) {
			console.error('Error compressing receipt:', error);
			toast.error('Gagal memproses gambar');
		} finally {
			input.value = '';
			showPhotoSourceMenu = false;
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

	function removePhoto(id: string) {
		const photo = photos.find((item) => item.id === id);
		if (photo) URL.revokeObjectURL(photo.preview);
		photos = photos.filter((item) => item.id !== id);
	}

	async function uploadPhoto(transactionId: string, photo: PendingPhoto): Promise<void> {
		const formData = new FormData();
		formData.append('file', photo.file);
		const response = await fetch(`/api/transactions/${transactionId}/photos`, {
			method: 'POST',
			body: formData
		});
		if (response.ok) return;

		let message = 'Foto gagal diunggah';
		try {
			const result = (await response.json()) as { error?: string };
			if (result.error) message = result.error;
		} catch {
			// Keep a useful fallback when an intermediary returns a non-JSON error.
		}
		throw new Error(message);
	}

	async function uploadPendingPhotos(transactionId: string) {
		uploading = true;
		try {
			const outcome = await uploadAttachments(photos, (photo) => uploadPhoto(transactionId, photo));
			for (const photo of outcome.succeeded) URL.revokeObjectURL(photo.preview);
			photos = outcome.failed.map(({ attachment, error }) => ({ ...attachment, error }));

			if (photos.length === 0) {
				await goto('/transaksi?success=created');
			}
		} finally {
			uploading = false;
		}
	}

	async function retryPhotos() {
		if (!savedTransactionId) return;
		if (photos.length === 0) {
			await goto('/transaksi?success=created');
			return;
		}
		await uploadPendingPhotos(savedTransactionId);
	}

	async function finishWithoutPhotos() {
		for (const photo of photos) URL.revokeObjectURL(photo.preview);
		photos = [];
		await goto('/transaksi?success=created-without-receipts');
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const validation = validateTransactionForm({ amount, accountId, date });
		if (!validation.valid) {
			toast.warning(validation.message);
			return;
		}

		loading = true;
		try {
			const response = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': commandId },
				body: JSON.stringify({
					type,
					amount: validation.amount,
					category_id: categoryId || undefined,
					account_id: accountId,
					date,
					description: description || undefined,
					reference_number: referenceNumber || undefined,
					notes: notes || undefined
				})
			});
			const result = (await response.json()) as { error?: string; transaction?: { id: string } };
			if (!response.ok || !result.transaction?.id) {
				throw new Error(result.error || 'Gagal menyimpan transaksi');
			}

			savedTransactionId = result.transaction.id;
			draftReady = false;
			clearTransactionDraft();

			if (photos.length === 0) {
				await goto('/transaksi?success=created');
				return;
			}
			await uploadPendingPhotos(result.transaction.id);
		} catch (error) {
			console.error('Error saving transaction:', error);
			toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan server');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Tambah Transaksi - Buku UMKM</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<header class="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
		<a
			href="/transaksi"
			class="-ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-secondary"
			aria-label="Kembali ke daftar transaksi"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<h1 class="text-lg font-semibold">Tambah Transaksi</h1>
	</header>

	{#if savedTransactionId}
		<main class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 md:p-6">
			{#if photos.length > 0}
				<section
					class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
					role="status"
				>
					<div class="flex items-start gap-3">
						<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
						<div>
							<h2 class="font-semibold">Transaksi tersimpan, tetapi foto belum lengkap</h2>
							<p class="mt-1 text-sm">
								Catatan keuangan dan saldo sudah aman tersimpan. Coba unggah ulang foto di bawah;
								menekan Simpan lagi tidak diperlukan.
							</p>
						</div>
					</div>
				</section>

				<section class="space-y-3" aria-labelledby="failed-receipts-title">
					<h2 id="failed-receipts-title" class="font-semibold">Foto yang belum terunggah</h2>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each photos as photo (photo.id)}
							<div class="flex gap-3 rounded-lg border p-3">
								<img
									src={photo.preview}
									alt="Pratinjau foto nota yang gagal diunggah"
									class="h-20 w-20 rounded-md object-cover"
								/>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{photo.file.name}</p>
									<p class="mt-1 text-xs text-destructive">{photo.error || 'Unggahan gagal'}</p>
									<button
										type="button"
										onclick={() => removePhoto(photo.id)}
										class="mt-2 min-h-11 text-sm text-destructive hover:underline"
										>Buang foto</button
									>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<div class="mt-auto grid gap-3 border-t pt-4 sm:grid-cols-2">
					<button
						type="button"
						onclick={retryPhotos}
						disabled={uploading}
						class="min-h-12 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
					>
						{uploading ? 'Mengunggah ulang…' : 'Coba unggah ulang'}
					</button>
					<button
						type="button"
						onclick={finishWithoutPhotos}
						disabled={uploading}
						class="min-h-12 rounded-lg border px-4 font-medium hover:bg-secondary disabled:opacity-50"
						>Selesai tanpa foto</button
					>
				</div>
			{:else}
				<section
					class="rounded-xl border border-green-300 bg-green-50 p-4 text-green-950"
					role="status"
				>
					<div class="flex items-start gap-3">
						<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0" />
						<div>
							<h2 class="font-semibold">Transaksi berhasil disimpan</h2>
							<p class="mt-1 text-sm">Tidak ada foto nota yang menunggu untuk diunggah.</p>
						</div>
					</div>
				</section>
				<button
					type="button"
					onclick={finishWithoutPhotos}
					class="mt-auto min-h-12 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
					>Kembali ke daftar transaksi</button
				>
			{/if}
			<a
				href={`/transaksi/${savedTransactionId}`}
				class="min-h-11 text-center text-sm text-primary hover:underline"
				>Lihat transaksi yang tersimpan</a
			>
		</main>
	{:else}
		{#snippet draftNotice()}
			<div
				class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950"
				role="status"
			>
				<p>
					{draftRestored ? 'Draft sebelumnya dipulihkan. ' : ''}Isian formulir disimpan sementara di
					perangkat ini sampai transaksi berhasil disimpan.
				</p>
				<p class="mt-1 text-blue-800">Foto nota tidak termasuk dalam draft perangkat.</p>
			</div>
		{/snippet}

		{#snippet receiptFields()}
			<section class="space-y-2" aria-labelledby="receipt-title">
				<div class="flex items-center justify-between gap-3">
					<div>
						<h2 id="receipt-title" class="text-sm font-medium text-muted-foreground">
							Foto nota <span class="font-normal">(opsional)</span>
						</h2>
						{#if photos.length > 0}<p class="text-xs text-muted-foreground">
								{photos.length}/{MAX_PHOTOS} foto
							</p>{/if}
					</div>
					{#if canAddPhoto}
						<button
							type="button"
							onclick={() => (showPhotoSourceMenu = true)}
							class="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
							><Camera class="h-4 w-4" />Tambah</button
						>
					{/if}
				</div>

				{#if photos.length > 0}
					<div class="flex flex-wrap gap-3">
						{#each photos as photo (photo.id)}
							<div class="group relative">
								<img
									src={photo.preview}
									alt="Pratinjau foto nota"
									class="h-20 w-20 rounded-lg border object-cover"
								/>
								<button
									type="button"
									onclick={() => removePhoto(photo.id)}
									class="absolute -right-2 -top-2 flex min-h-8 min-w-8 items-center justify-center rounded-full bg-destructive text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
									aria-label={`Hapus ${photo.file.name}`}><Trash2 class="h-4 w-4" /></button
								>
							</div>
						{/each}
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (showPhotoSourceMenu = true)}
						class="flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/50"
						><Image class="h-5 w-5" />Tambah foto nota</button
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
			formId="create-transaction"
			mode="create"
			bind:type
			bind:amount
			bind:categoryId
			bind:accountId
			bind:date
			bind:description
			bind:referenceNumber
			bind:notes
			categoriesByType={data.categories}
			accounts={data.accounts}
			templates={data.templates}
			returnTo="/transaksi/tambah"
			busy={loading || uploading}
			submitLabel="Simpan transaksi"
			onsubmit={handleSubmit}
			notice={draftNotice}
			attachments={receiptFields}
		/>
	{/if}
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

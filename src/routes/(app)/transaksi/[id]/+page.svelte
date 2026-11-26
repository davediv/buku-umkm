<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowLeft, Camera, Image, Trash2, Undo2, X } from '@lucide/svelte';
	import ContextBackLink from '$lib/components/context-back-link.svelte';
	import OperationStatus from '$lib/components/operation-status.svelte';
	import TransactionForm from '$lib/components/transactions/transaction-form.svelte';
	import { Dialog } from '$lib/components/ui/dialog';
	import { validateTransactionForm } from '$lib/client/transaction-form';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogDescription,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { toast } from '$lib/components/ui/toast';
	import { compressImage, formatDate, formatRupiah } from '$lib/utils';
	import { getSafeTransactionListHref, getTransactionOutcomeHref } from '$lib/transactions/query';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	function getInitialTransactionData() {
		return { transaction: data.transaction, photos: data.photos ?? [] };
	}
	const initialData = getInitialTransactionData();
	const initialTransaction = initialData.transaction;
	const initialPhotos = initialData.photos;

	let type = $state<'income' | 'expense'>(
		(initialTransaction?.type as 'income' | 'expense') || 'expense'
	);
	let amount = $state(initialTransaction?.amount?.toString() || '');
	let categoryId = $state(initialTransaction?.categoryId || '');
	let accountId = $state(initialTransaction?.accountId || '');
	let date = $state(initialTransaction?.date || '');
	let description = $state(initialTransaction?.description || '');
	let referenceNumber = $state(initialTransaction?.referenceNumber || '');
	let notes = $state(initialTransaction?.notes || '');
	let loading = $state(false);
	let deleting = $state(false);
	let showDeleteConfirm = $state(false);

	let photos = $state(initialPhotos);
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
	let transactionReturnTo = $derived(
		getSafeTransactionListHref(page.url.searchParams.get('return_to')) ?? '/transaksi'
	);
	let currentDetailHref = $derived(`${page.url.pathname}${page.url.search}`);

	// Transfer legs and debt movements are written together with their counterpart, so
	// they are corrected as a whole: a transfer is reversed, a debt payment from its debt.
	let transfer = $derived.by(() => {
		const item = data.transaction;
		if (!item.toAccountId) return null;
		const outgoing = item.type === 'expense';
		return {
			id: item.referenceNumber,
			from: (outgoing ? item.account?.name : item.toAccount?.name) ?? 'akun sumber',
			to: (outgoing ? item.toAccount?.name : item.account?.name) ?? 'akun tujuan'
		};
	});
	let debtId = $derived(transfer ? null : data.transaction.debtId);
	let linked = $derived(transfer !== null || debtId !== null);
	let showReverseConfirm = $state(false);
	let reversing = $state(false);
	let reversalStatus = $state<{ kind: 'success' | 'error'; message: string } | null>(null);

	async function handleReverseTransfer() {
		if (!transfer?.id) return;
		reversing = true;
		reversalStatus = null;
		try {
			const response = await fetch(`/api/transfers/${encodeURIComponent(transfer.id)}`, {
				method: 'DELETE'
			});
			const result = (await response.json()) as { error?: string; message?: string };
			if (!response.ok) {
				reversalStatus = {
					kind: 'error',
					message: result.error || 'Transfer belum dapat dibatalkan.'
				};
				return;
			}
			reversalStatus = { kind: 'success', message: result.message ?? 'Transfer dibatalkan.' };
			await invalidateAll();
		} catch (reverseError) {
			console.error('Error reversing transfer:', reverseError);
			reversalStatus = {
				kind: 'error',
				message: 'Tidak dapat terhubung ke server. Transfer belum dibatalkan.'
			};
		} finally {
			reversing = false;
			showReverseConfirm = false;
		}
	}

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
			await goto(getTransactionOutcomeHref(transactionReturnTo, 'updated'));
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
			await goto(getTransactionOutcomeHref(transactionReturnTo, 'deleted'));
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
	<title
		>{transfer ? 'Detail Transfer' : linked ? 'Detail Transaksi' : 'Edit Transaksi'} - Buku UMKM</title
	>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background">
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3"
	>
		<div class="flex items-center gap-3">
			<ContextBackLink
				href={transactionReturnTo}
				label="Kembali ke daftar transaksi"
				compact
				class="-ml-2 h-11 w-11 justify-center gap-0 rounded-full text-foreground [&_svg]:h-5 [&_svg]:w-5"
			/>
			<h1 class="text-lg font-semibold">
				{transfer ? 'Detail Transfer' : linked ? 'Detail Transaksi' : 'Edit Transaksi'}
			</h1>
		</div>
		{#if !linked}
			<button
				type="button"
				onclick={() => (showDeleteConfirm = true)}
				class="flex h-11 w-11 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
				aria-label="Hapus transaksi"><Trash2 class="h-5 w-5" /></button
			>
		{/if}
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

	{#if linked}
		<div class="flex flex-1 flex-col gap-5 p-4">
			{#if reversalStatus}
				<OperationStatus
					kind={reversalStatus.kind}
					message={reversalStatus.message}
					ondismiss={() => (reversalStatus = null)}
				/>
			{/if}
			{#if !data.transaction.isActive && reversalStatus?.kind !== 'success'}
				<OperationStatus
					kind="info"
					message={transfer
						? 'Transfer ini sudah dibatalkan. Saldo kedua akun sudah dikembalikan.'
						: 'Transaksi ini sudah dibatalkan dan tidak lagi dihitung di saldo.'}
				/>
			{/if}

			<section class="rounded-xl border bg-card p-4" aria-labelledby="linked-amount-label">
				<p id="linked-amount-label" class="text-sm text-muted-foreground">Jumlah</p>
				<p class="text-3xl font-bold">{formatRupiah(data.transaction.amount)}</p>
				<dl class="mt-4 grid gap-3 text-sm">
					<div class="flex gap-3">
						<dt class="w-28 shrink-0 text-muted-foreground">Tanggal</dt>
						<dd>{formatDate(data.transaction.date)}</dd>
					</div>
					{#if transfer}
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-muted-foreground">Dari</dt>
							<dd class="min-w-0 break-words">{transfer.from}</dd>
						</div>
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-muted-foreground">Ke</dt>
							<dd class="min-w-0 break-words">{transfer.to}</dd>
						</div>
					{:else}
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-muted-foreground">Kas/rekening</dt>
							<dd class="min-w-0 break-words">{data.transaction.account?.name ?? '-'}</dd>
						</div>
					{/if}
					<div class="flex gap-3">
						<dt class="w-28 shrink-0 text-muted-foreground">Keterangan</dt>
						<dd class="min-w-0 break-words">{data.transaction.description || '-'}</dd>
					</div>
					{#if data.transaction.notes}
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-muted-foreground">Catatan</dt>
							<dd class="min-w-0 break-words">{data.transaction.notes}</dd>
						</div>
					{/if}
				</dl>
			</section>

			{#if transfer && data.transaction.isActive}
				<p class="text-sm text-muted-foreground">
					Transfer tidak dapat diubah. Bila jumlah, tanggal, atau akunnya salah, batalkan transfer
					ini lalu catat ulang yang benar dari Kas & Rekening.
				</p>
				{#if transfer.id}
					<button
						type="button"
						onclick={() => {
							reversalStatus = null;
							showReverseConfirm = true;
						}}
						class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive px-4 text-base font-medium text-destructive transition-colors hover:bg-destructive/10"
					>
						<Undo2 class="h-4 w-4" aria-hidden="true" />Batalkan transfer
					</button>
				{/if}
			{:else if debtId}
				<p class="text-sm text-muted-foreground">
					Transaksi ini tercatat dari catatan utang/piutang. Untuk mengoreksinya, buka catatan
					tersebut.
				</p>
				<a
					href="/hutang-piutang/{debtId}"
					class="inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-4 text-base font-medium transition-colors hover:bg-secondary"
					>Buka catatan utang/piutang</a
				>
			{/if}
		</div>
	{:else}
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
			returnTo={currentDetailHref}
			busy={loading}
			submitLabel="Simpan perubahan"
			onsubmit={handleSubmit}
			attachments={receiptFields}
		/>
	{/if}
</div>

<Dialog
	open={showPhotoSourceMenu}
	onopenchange={(open) => (showPhotoSourceMenu = open)}
	labelledby="photo-source-title"
	overlayClass="z-[60]"
	class="max-w-sm rounded-xl bg-background"
>
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
		class="mt-4 min-h-11 w-full text-sm text-muted-foreground hover:text-foreground">Batal</button
	>
</Dialog>

{#if showPhotoViewer && photos[selectedPhotoIndex]}
	<Dialog
		open={showPhotoViewer}
		onopenchange={(open) => (showPhotoViewer = open)}
		ariaLabel="Lihat foto nota"
		closeOnOutsideClick={false}
		overlayClass="z-[60] bg-black p-0"
		class="relative flex h-full w-full max-w-none items-center justify-center rounded-none border-0 bg-black p-0 shadow-none"
	>
		<button
			data-dialog-initial-focus
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
	</Dialog>
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

<AlertDialog
	open={showReverseConfirm}
	closeOnExternalClick={!reversing}
	onopenchange={(open) => !open && !reversing && (showReverseConfirm = false)}
>
	<AlertDialogTitle>Batalkan transfer?</AlertDialogTitle>
	{#if transfer}
		<AlertDialogDescription>
			Transfer {formatRupiah(data.transaction.amount)} dari {transfer.from} ke {transfer.to} tanggal
			{formatDate(data.transaction.date)} akan dibatalkan. Saldo {transfer.to} berkurang
			{formatRupiah(data.transaction.amount)} dan saldo {transfer.from} bertambah
			{formatRupiah(data.transaction.amount)}.
		</AlertDialogDescription>
		<p class="mt-3 text-sm text-muted-foreground">
			Uangnya harus masih ada di {transfer.to}. Transfer tidak dihitung sebagai pemasukan atau
			pengeluaran, jadi laporan laba rugi tidak berubah.
		</p>
	{/if}
	<div class="mt-6 flex gap-3">
		<AlertDialogCancel disabled={reversing}>Kembali</AlertDialogCancel>
		<AlertDialogAction onclick={handleReverseTransfer} loading={reversing}>
			{reversing ? 'Membatalkan…' : 'Ya, batalkan'}
		</AlertDialogAction>
	</div>
</AlertDialog>

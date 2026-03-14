<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		ArrowLeft,
		Download,
		Upload,
		Database,
		Calendar,
		AlertTriangle,
		CheckCircle,
		X,
		Loader2
	} from '@lucide/svelte';
	import { APP_VERSION } from '$lib/constants';

	// State
	let backingUp = $state(false);
	let restoring = $state(false);
	let showRestoreConfirm = $state(false);
	let selectedFile = $state<File | null>(null);
	let restoreError = $state<string | null>(null);
	let lastBackupDate = $state<string | null>(null);
	let fileInputRef: HTMLInputElement;

	// Initialize last backup date from localStorage
	$effect(() => {
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('lastBackupDate');
			if (stored) {
				lastBackupDate = stored;
			}
		}
	});

	// Format date for display
	function formatDate(dateString: string | null): string {
		if (!dateString) return '-';
		const date = new Date(dateString);
		return date.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Handle backup
	async function handleBackup() {
		backingUp = true;
		restoreError = null;

		try {
			const response = await fetch('/api/backup', {
				method: 'POST'
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new Error(errorData.error || 'Gagal membuat backup');
			}

			// Get the blob and trigger download
			const blob = await response.blob();
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
			if (contentDisposition) {
				const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
				if (match) {
					filename = match[1];
				}
			}

			// Create download link
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			// Save last backup date
			const now = new Date().toISOString();
			localStorage.setItem('lastBackupDate', now);
			lastBackupDate = now;

			alert('Backup berhasil dibuat!');
		} catch (error) {
			console.error('Backup error:', error);
			alert(error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat backup');
		} finally {
			backingUp = false;
		}
	}

	// Handle file selection
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectedFile = file;
			showRestoreConfirm = true;
		}
	}

	// Handle restore confirmation
	async function confirmRestore() {
		if (!selectedFile) return;

		restoring = true;
		restoreError = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/restore', {
				method: 'POST',
				body: formData
			});

			const result = (await response.json()) as { success?: boolean; error?: string };

			if (!response.ok) {
				throw new Error(result.error || 'Gagal memulihkan data');
			}

			showRestoreConfirm = false;
			selectedFile = null;

			// Reset file input
			if (fileInputRef) {
				fileInputRef.value = '';
			}

			// Invalidate all data
			await invalidateAll();

			alert('Data berhasil dipulihkan!');
		} catch (error) {
			console.error('Restore error:', error);
			restoreError =
				error instanceof Error ? error.message : 'Terjadi kesalahan saat memulihkan data';
		} finally {
			restoring = false;
		}
	}

	// Cancel restore
	function cancelRestore() {
		showRestoreConfirm = false;
		selectedFile = null;
		restoreError = null;
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}
</script>

<svelte:head>
	<title>Pengaturan - Buku UMKM</title>
</svelte:head>

<div class="min-h-screen bg-background flex flex-col">
	<!-- Header -->
	<header class="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
		<a
			href="/lainnya"
			class="p-2 -ml-2 hover:bg-secondary rounded-full transition-colors"
			aria-label="Kembali"
		>
			<ArrowLeft class="w-5 h-5" />
		</a>
		<h1 class="text-lg font-semibold">Pengaturan</h1>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4 space-y-6">
		<!-- Backup & Restore Section -->
		<section class="space-y-4">
			<div class="flex items-center gap-2">
				<Database class="w-5 h-5 text-primary" />
				<h2 class="text-lg font-semibold">Cadangkan & Pulihkan Data</h2>
			</div>

			<div class="p-4 bg-card rounded-lg border space-y-4">
				<!-- Last Backup Info -->
				<div class="flex items-center gap-3 text-sm text-muted-foreground">
					<Calendar class="w-4 h-4" />
					<span>Cadangan terakhir: {formatDate(lastBackupDate)}</span>
				</div>

				<!-- Action Buttons -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<!-- Backup Button -->
					<button
						type="button"
						onclick={handleBackup}
						disabled={backingUp}
						class="flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if backingUp}
							<Loader2 class="w-5 h-5 animate-spin" />
							<span>Membuat backup...</span>
						{:else}
							<Download class="w-5 h-5" />
							<span>Cadangkan Data</span>
						{/if}
					</button>

					<!-- Restore Button -->
					<button
						type="button"
						onclick={() => fileInputRef?.click()}
						disabled={restoring}
						class="flex items-center justify-center gap-2 py-3 px-4 border rounded-lg font-medium hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if restoring}
							<Loader2 class="w-5 h-5 animate-spin" />
							<span>Memulihkan...</span>
						{:else}
							<Upload class="w-5 h-5" />
							<span>Pulihkan Data</span>
						{/if}
					</button>
				</div>

				<!-- Hidden file input -->
				<input
					bind:this={fileInputRef}
					type="file"
					accept=".json,application/json"
					onchange={handleFileSelect}
					class="hidden"
				/>

				<!-- Info text -->
				<p class="text-xs text-muted-foreground">
					File backup dapat digunakan untuk memulihkan data jika terjadi masalah pada perangkat
					Anda.
				</p>
			</div>
		</section>

		<!-- App Info Section -->
		<section class="space-y-4">
			<h2 class="text-lg font-semibold">Tentang Aplikasi</h2>
			<div class="p-4 bg-card rounded-lg border space-y-2">
				<p class="font-medium">Buku UMKM</p>
				<p class="text-sm text-muted-foreground">Versi {APP_VERSION}</p>
				<p class="text-xs text-muted-foreground">
					Aplikasi bookkeeping gratis dan open-source untuk pelaku UMKM Indonesia
				</p>
			</div>
		</section>
	</div>
</div>

<!-- Restore Confirmation Dialog -->
{#if showRestoreConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-background border rounded-lg shadow-lg w-full max-w-md">
			<div class="flex items-center justify-between p-4 border-b">
				<div class="flex items-center gap-2">
					<AlertTriangle class="w-5 h-5 text-amber-500" />
					<h2 class="text-lg font-semibold">Peringatan</h2>
				</div>
				<button
					type="button"
					onclick={cancelRestore}
					class="p-2 hover:bg-secondary rounded-full"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="p-4 space-y-4">
				<p class="text-muted-foreground">Apakah Anda yakin ingin memulihkan data?</p>
				<div
					class="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg"
				>
					<p class="text-sm text-amber-800 dark:text-amber-200 font-medium">
						Data saat ini akan ditimpa!
					</p>
					<p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
						{#if selectedFile}
							File: {selectedFile.name}
						{/if}
					</p>
				</div>

				{#if restoreError}
					<div
						class="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg"
					>
						<p class="text-sm text-red-800 dark:text-red-200">{restoreError}</p>
					</div>
				{/if}

				<div class="flex gap-3">
					<button
						type="button"
						onclick={cancelRestore}
						class="flex-1 py-3 border rounded-lg font-medium hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="button"
						onclick={confirmRestore}
						disabled={restoring}
						class="flex-1 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
					>
						{#if restoring}
							<Loader2 class="w-5 h-5 animate-spin" />
							<span>Memulihkan...</span>
						{:else}
							<CheckCircle class="w-5 h-5" />
							<span>Ya, Pulihkan</span>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		ArrowRight,
		Calendar,
		Phone,
		MapPin,
		FileText,
		Wallet,
		Clock,
		CheckCircle,
		AlertCircle,
		X,
		Plus
	} from '@lucide/svelte';
	import { formatRupiah, formatDate, getDebtStatusBadge } from '$lib/utils';

	let { data } = $props();

	// State
	let showPaymentModal = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	// Form state
	let paymentAmount = $state<number | string>('');
	let paymentDate = $state(new Date().toISOString().split('T')[0]);
	let paymentAccount = $state('');
	let paymentNotes = $state('');

	// Derived
	let debt = $derived(data.debt);
	let payments = $derived(data.payments);
	let accounts = $derived(data.accounts);
	let statusBadge = $derived(getDebtStatusBadge(debt.status));

	// Pre-fill payment amount with remaining balance
	$effect(() => {
		if (showPaymentModal && debt.remainingAmount) {
			paymentAmount = debt.remainingAmount;
		}
	});

	// Get type label
	function getTypeLabel(type: string): string {
		return type === 'piutang' ? 'Piutang' : 'Hutang';
	}

	// Get type color
	function getTypeColor(type: string): string {
		return type === 'piutang' ? 'text-green-600' : 'text-red-600';
	}

	// Open payment modal
	function openPaymentModal() {
		error = null;
		success = null;
		paymentAmount = debt.remainingAmount;
		paymentDate = new Date().toISOString().split('T')[0];
		paymentAccount = '';
		paymentNotes = '';
		showPaymentModal = true;
	}

	// Close modal
	function closePaymentModal() {
		showPaymentModal = false;
	}

	// Handle payment submit
	async function handlePaymentSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		success = null;

		const amount = Number(paymentAmount);

		// Validate amount
		if (amount <= 0) {
			error = 'Jumlah pembayaran harus lebih dari 0';
			loading = false;
			return;
		}

		if (amount > debt.remainingAmount) {
			error = `Jumlah pembayaran tidak boleh melebihi sisa tagihan (${formatRupiah(debt.remainingAmount)})`;
			loading = false;
			return;
		}

		if (!paymentAccount) {
			error = 'Akun wajib dipilih';
			loading = false;
			return;
		}

		try {
			const response = await fetch(`/api/debts/${debt.id}/payments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount,
					date: paymentDate,
					account_id: paymentAccount,
					notes: paymentNotes || undefined
				})
			});

			const result = (await response.json()) as { error?: string; message?: string };

			if (!response.ok) {
				error = result.error || 'Terjadi kesalahan';
				loading = false;
				return;
			}

			success = result.message ?? null;
			closePaymentModal();
			goto(`/hutang-piutang/${debt.id}`, { invalidateAll: true });
		} catch (err) {
			error = 'Terjadi kesalahan server';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	// Go back
	function goBack() {
		goto('/hutang-piutang?type=' + debt.type);
	}
</script>

<svelte:head>
	<title>Detail {getTypeLabel(debt.type)} - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	<!-- Back Button -->
	<button
		onclick={goBack}
		class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
	>
		<ArrowLeft class="w-4 h-4" />
		Kembali ke Daftar {getTypeLabel(debt.type)}
	</button>

	<!-- Header -->
	<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
		<div class="flex items-start gap-4">
			<div
				class="w-12 h-12 rounded-full flex items-center justify-center {debt.type === 'piutang'
					? 'bg-green-100'
					: 'bg-red-100'}"
			>
				{#if debt.type === 'piutang'}
					<ArrowLeft class="w-6 h-6 text-green-600" />
				{:else}
					<ArrowRight class="w-6 h-6 text-red-600" />
				{/if}
			</div>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold">{debt.contactName}</h1>
					<span
						class="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full {statusBadge.class}"
					>
						{statusBadge.label}
					</span>
				</div>
				<p class="text-sm text-muted-foreground">
					{getTypeLabel(debt.type)} - Dibuat {formatDate(debt.date)}
				</p>
			</div>
		</div>

		<!-- Record Payment Button -->
		{#if debt.status !== 'paid'}
			<button
				onclick={openPaymentModal}
				class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
			>
				<Plus class="w-4 h-4" />
				Catat Pembayaran
			</button>
		{:else}
			<div class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-md">
				<CheckCircle class="w-4 h-4" />
				<span class="text-sm font-medium">Lunas</span>
			</div>
		{/if}
	</div>

	<!-- Amount Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="bg-card border rounded-lg p-4">
			<div class="flex items-center gap-2 mb-1">
				<Wallet class="w-4 h-4 text-muted-foreground" />
				<span class="text-sm text-muted-foreground">Jumlah Awal</span>
			</div>
			<p class="text-xl font-semibold {getTypeColor(debt.type)}">
				{formatRupiah(debt.originalAmount)}
			</p>
		</div>
		<div class="bg-card border rounded-lg p-4">
			<div class="flex items-center gap-2 mb-1">
				<CheckCircle class="w-4 h-4 text-muted-foreground" />
				<span class="text-sm text-muted-foreground">Sudah Dibayar</span>
			</div>
			<p class="text-xl font-semibold text-green-600">{formatRupiah(debt.paidAmount)}</p>
		</div>
		<div class="bg-card border rounded-lg p-4">
			<div class="flex items-center gap-2 mb-1">
				<Clock class="w-4 h-4 text-muted-foreground" />
				<span class="text-sm text-muted-foreground">Sisa Tagihan</span>
			</div>
			<p class="text-xl font-semibold {debt.status === 'paid' ? 'text-green-600' : 'text-red-600'}">
				{formatRupiah(debt.remainingAmount)}
			</p>
		</div>
	</div>

	<!-- Details & Payment History Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Details -->
		<div class="bg-card border rounded-lg p-6">
			<h2 class="text-lg font-semibold mb-4">Detail</h2>
			<dl class="space-y-4">
				{#if debt.contactPhone}
					<div class="flex items-start gap-3">
						<Phone class="w-4 h-4 text-muted-foreground mt-0.5" />
						<div>
							<dt class="text-xs text-muted-foreground">No. Telepon</dt>
							<dd class="text-sm font-medium">{debt.contactPhone}</dd>
						</div>
					</div>
				{/if}

				{#if debt.contactAddress}
					<div class="flex items-start gap-3">
						<MapPin class="w-4 h-4 text-muted-foreground mt-0.5" />
						<div>
							<dt class="text-xs text-muted-foreground">Alamat</dt>
							<dd class="text-sm font-medium">{debt.contactAddress}</dd>
						</div>
					</div>
				{/if}

				<div class="flex items-start gap-3">
					<Calendar class="w-4 h-4 text-muted-foreground mt-0.5" />
					<div>
						<dt class="text-xs text-muted-foreground">Jatuh Tempo</dt>
						<dd class="text-sm font-medium">{formatDate(debt.dueDate)}</dd>
					</div>
				</div>

				{#if debt.description}
					<div class="flex items-start gap-3">
						<FileText class="w-4 h-4 text-muted-foreground mt-0.5" />
						<div>
							<dt class="text-xs text-muted-foreground">Keterangan</dt>
							<dd class="text-sm font-medium">{debt.description}</dd>
						</div>
					</div>
				{/if}
			</dl>
		</div>

		<!-- Payment History -->
		<div class="bg-card border rounded-lg p-6">
			<h2 class="text-lg font-semibold mb-4">Riwayat Pembayaran</h2>
			{#if payments.length > 0}
				<div class="space-y-3">
					{#each payments as payment (payment.id)}
						<div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
							<div class="flex items-center gap-3">
								<div
									class="w-8 h-8 rounded-full flex items-center justify-center {debt.type ===
									'piutang'
										? 'bg-green-100'
										: 'bg-red-100'}"
								>
									<CheckCircle
										class="w-4 h-4 {debt.type === 'piutang' ? 'text-green-600' : 'text-red-600'}"
									/>
								</div>
								<div>
									<p class="text-sm font-medium">{formatRupiah(payment.amount)}</p>
									<p class="text-xs text-muted-foreground">{formatDate(payment.date)}</p>
								</div>
							</div>
							{#if payment.notes}
								<p
									class="text-xs text-muted-foreground max-w-[120px] truncate"
									title={payment.notes}
								>
									{payment.notes}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8">
					<div
						class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3"
					>
						<Clock class="w-6 h-6 text-muted-foreground" />
					</div>
					<p class="text-sm text-muted-foreground">Belum ada pembayaran</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Payment Modal -->
{#if showPaymentModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="payment-modal-title"
	>
		<div
			class="bg-background border rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
		>
			<div class="flex items-center justify-between mb-6">
				<h2 id="payment-modal-title" class="text-lg font-semibold">Catat Pembayaran</h2>
				<button
					onclick={closePaymentModal}
					class="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Current Amount Info -->
			<div class="mb-6 p-3 bg-muted/50 rounded-lg">
				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">Sisa Tagihan</span>
					<span class="font-semibold {debt.status === 'paid' ? 'text-green-600' : 'text-red-600'}">
						{formatRupiah(debt.remainingAmount)}
					</span>
				</div>
			</div>

			<form onsubmit={handlePaymentSubmit} class="space-y-4">
				<div class="space-y-2">
					<label for="paymentAmount" class="text-sm font-medium">Jumlah Pembayaran *</label>
					<input
						id="paymentAmount"
						type="number"
						bind:value={paymentAmount}
						min="1"
						max={debt.remainingAmount}
						placeholder="Contoh: 500000"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
					<p class="text-xs text-muted-foreground">
						Maksimal: {formatRupiah(debt.remainingAmount)}
					</p>
				</div>

				<div class="space-y-2">
					<label for="paymentDate" class="text-sm font-medium">Tanggal *</label>
					<input
						id="paymentDate"
						type="date"
						bind:value={paymentDate}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="paymentAccount" class="text-sm font-medium">Akun *</label>
					<select
						id="paymentAccount"
						bind:value={paymentAccount}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					>
						<option value="">Pilih Akun</option>
						{#each accounts as account (account.id)}
							<option value={account.id}>
								{account.name} ({account.code})
							</option>
						{/each}
					</select>
				</div>

				<div class="space-y-2">
					<label for="paymentNotes" class="text-sm font-medium">Keterangan</label>
					<textarea
						id="paymentNotes"
						bind:value={paymentNotes}
						placeholder="Contoh: Pembayaran pertama"
						rows="2"
						class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
					></textarea>
				</div>

				{#if error}
					<div
						class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md flex items-center gap-2"
					>
						<AlertCircle class="w-4 h-4" />
						{error}
					</div>
				{/if}
				{#if success}
					<div
						class="bg-green-500/10 border border-green-500 text-green-500 text-sm p-3 rounded-md"
					>
						{success}
					</div>
				{/if}

				<div class="flex gap-3 pt-4">
					<button
						type="button"
						onclick={closePaymentModal}
						class="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={loading}
						class="flex-1 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
					>
						{loading ? 'Menyimpan...' : 'Simpan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

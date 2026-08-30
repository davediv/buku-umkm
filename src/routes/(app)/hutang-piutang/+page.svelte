<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		AlertCircle,
		ArrowDownToLine,
		ArrowUpFromLine,
		ChevronRight,
		FileText,
		Plus,
		Search,
		X
	} from '@lucide/svelte';
	import { getDebtDueState } from '$lib/debts/list';
	import { getDebtDetailHref, getDebtHref } from '$lib/debts/query';
	import { todayInJakarta } from '$lib/shared/dates';
	import { formatDate, formatRupiah } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showModal = $state(false);
	let loading = $state(false);
	let formError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let createType = $state<'piutang' | 'hutang'>('piutang');

	let contactName = $state('');
	let contactPhone = $state('');
	let contactAddress = $state('');
	let amount = $state<number | string>('');
	let date = $state(todayInJakarta());
	let dueDate = $state('');
	let description = $state('');
	let createCommandId = $state('');

	let query = $derived(data.query);
	let selectedSummary = $derived(data.summary[query.type]);
	let hasFilters = $derived(
		query.q !== '' ||
			query.status !== 'outstanding' ||
			query.due !== 'all' ||
			query.sort !== 'urgency'
	);

	function typeLabel(type: 'piutang' | 'hutang'): string {
		return type === 'piutang' ? 'Piutang' : 'Utang';
	}

	function nextAction(type: string, paid: boolean): string {
		if (paid) return 'Lihat detail';
		return type === 'piutang' ? 'Catat penerimaan' : 'Catat pembayaran';
	}

	function submitFilters(event: Event) {
		(event.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}

	function openCreateModal(type: 'piutang' | 'hutang') {
		createType = type;
		formError = null;
		contactName = '';
		contactPhone = '';
		contactAddress = '';
		amount = '';
		date = todayInJakarta();
		dueDate = '';
		description = '';
		createCommandId = crypto.randomUUID();
		showModal = true;
	}

	function closeModal() {
		if (!loading) showModal = false;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		loading = true;
		formError = null;

		try {
			const response = await fetch('/api/debts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': createCommandId
				},
				body: JSON.stringify({
					type: createType,
					contact_name: contactName,
					contact_phone: contactPhone || undefined,
					contact_address: contactAddress || undefined,
					amount: Number(amount),
					date,
					due_date: dueDate || undefined,
					description: description || undefined
				})
			});
			const result = (await response.json()) as { error?: string; message?: string };
			if (!response.ok) {
				formError = result.error || 'Catatan gagal disimpan';
				return;
			}

			successMessage = result.message || `${typeLabel(createType)} berhasil disimpan`;
			showModal = false;
			await goto(
				getDebtHref(query, {
					type: createType,
					status: 'outstanding',
					due: 'all',
					q: '',
					sort: 'urgency'
				}),
				{ invalidateAll: true }
			);
		} catch (error) {
			console.error('Error creating debt:', error);
			formError = 'Tidak dapat terhubung ke server. Isian Anda belum disimpan.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Utang & Piutang - Buku UMKM</title>
</svelte:head>

<div class="space-y-6 p-4 md:p-6">
	<header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Utang & Piutang</h1>
			<p class="text-sm text-muted-foreground">
				Pantau tagihan, tenggat, dan pembayaran dari satu tempat
			</p>
		</div>
		<div class="grid grid-cols-2 gap-2 sm:flex">
			<button
				type="button"
				onclick={() => openCreateModal('piutang')}
				class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800"
			>
				<ArrowUpFromLine class="h-4 w-4" />Tambah Piutang
			</button>
			<button
				type="button"
				onclick={() => openCreateModal('hutang')}
				class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800"
			>
				<ArrowDownToLine class="h-4 w-4" />Tambah Utang
			</button>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<a
			href={getDebtHref(query, { type: 'piutang' })}
			aria-current={query.type === 'piutang' ? 'page' : undefined}
			class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50 {query.type ===
			'piutang'
				? 'ring-2 ring-green-600'
				: ''}"
		>
			<div class="mb-1 flex items-center gap-2">
				<ArrowUpFromLine class="h-4 w-4 text-green-700" /><span
					class="text-sm text-muted-foreground">Total Piutang</span
				>
			</div>
			<p class="text-xl font-semibold text-green-700">
				{formatRupiah(data.summary.piutang.remaining)}
			</p>
			<p class="mt-2 text-xs text-muted-foreground">
				{data.summary.piutang.overdueCount} terlambat · {data.summary.piutang.dueSoonCount} dekat jatuh
				tempo
			</p>
		</a>
		<a
			href={getDebtHref(query, { type: 'hutang' })}
			aria-current={query.type === 'hutang' ? 'page' : undefined}
			class="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50 {query.type ===
			'hutang'
				? 'ring-2 ring-red-600'
				: ''}"
		>
			<div class="mb-1 flex items-center gap-2">
				<ArrowDownToLine class="h-4 w-4 text-red-700" /><span class="text-sm text-muted-foreground"
					>Total Utang</span
				>
			</div>
			<p class="text-xl font-semibold text-red-700">
				{formatRupiah(data.summary.hutang.remaining)}
			</p>
			<p class="mt-2 text-xs text-muted-foreground">
				{data.summary.hutang.overdueCount} terlambat · {data.summary.hutang.dueSoonCount} dekat jatuh
				tempo
			</p>
		</a>
	</div>

	<nav class="flex border-b" aria-label="Jenis catatan">
		<a
			href={getDebtHref(query, { type: 'piutang' })}
			aria-current={query.type === 'piutang' ? 'page' : undefined}
			class="inline-flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-4 text-sm font-medium sm:flex-none {query.type ===
			'piutang'
				? 'border-green-700 text-green-700'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<ArrowUpFromLine class="h-4 w-4" />Piutang
			<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
				>{data.summary.piutang.count}</span
			>
		</a>
		<a
			href={getDebtHref(query, { type: 'hutang' })}
			aria-current={query.type === 'hutang' ? 'page' : undefined}
			class="inline-flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-4 text-sm font-medium sm:flex-none {query.type ===
			'hutang'
				? 'border-red-700 text-red-700'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<ArrowDownToLine class="h-4 w-4" />Utang
			<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
				>{data.summary.hutang.count}</span
			>
		</a>
	</nav>

	<form
		method="GET"
		class="grid gap-3 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto]"
	>
		<input type="hidden" name="type" value={query.type} />
		<div class="relative">
			<label for="debt-search" class="sr-only">Cari nama, telepon, atau keterangan</label>
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				id="debt-search"
				name="q"
				type="search"
				value={query.q}
				placeholder="Nama, telepon, atau keterangan…"
				class="h-11 w-full rounded-md border bg-background pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
		</div>
		<div>
			<label for="debt-status" class="sr-only">Status pembayaran</label>
			<select
				id="debt-status"
				name="status"
				value={query.status}
				onchange={submitFilters}
				class="h-11 w-full rounded-md border bg-background px-3 text-sm"
			>
				<option value="outstanding">Belum lunas</option>
				<option value="paid">Lunas</option>
				<option value="all">Semua status</option>
			</select>
		</div>
		<div>
			<label for="debt-due" class="sr-only">Status jatuh tempo</label>
			<select
				id="debt-due"
				name="due"
				value={query.due}
				onchange={submitFilters}
				disabled={query.status === 'paid'}
				class="h-11 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
			>
				<option value="all">Semua tenggat</option>
				<option value="overdue">Terlambat</option>
				<option value="due-soon">Jatuh tempo ≤ 7 hari</option>
				<option value="no-due-date">Tanpa jatuh tempo</option>
			</select>
		</div>
		<div>
			<label for="debt-sort" class="sr-only">Urutkan</label>
			<select
				id="debt-sort"
				name="sort"
				value={query.sort}
				onchange={submitFilters}
				class="h-11 w-full rounded-md border bg-background px-3 text-sm"
			>
				<option value="urgency">Paling mendesak</option>
				<option value="due-asc">Jatuh tempo terdekat</option>
				<option value="balance-desc">Sisa terbesar</option>
				<option value="balance-asc">Sisa terkecil</option>
				<option value="contact-asc">Nama A–Z</option>
			</select>
		</div>
		<button
			type="submit"
			class="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>Terapkan</button
		>
	</form>

	{#if successMessage}
		<div
			class="rounded-md border border-green-500 bg-green-500/10 p-3 text-sm text-green-800"
			role="status"
		>
			{successMessage}
		</div>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">
			<strong class="text-foreground">{data.debts.length}</strong> catatan {typeLabel(
				query.type
			).toLocaleLowerCase('id-ID')} ditampilkan
		</p>
		{#if selectedSummary.overdueCount > 0 && query.status !== 'paid'}
			<a
				href={getDebtHref(query, { due: 'overdue', status: 'outstanding' })}
				class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-red-700 hover:underline"
				><AlertCircle class="h-4 w-4" />{selectedSummary.overdueCount} perlu ditindaklanjuti</a
			>
		{/if}
	</div>

	{#if data.debts.length > 0}
		<div class="space-y-3 md:hidden">
			{#each data.debts as debt (debt.id)}
				{@const dueState = getDebtDueState(debt, data.today)}
				{@const paid = dueState.kind === 'paid'}
				<article
					class="rounded-xl border bg-card p-4 {dueState.kind === 'overdue'
						? 'border-l-4 border-l-red-600'
						: dueState.kind === 'due-soon'
							? 'border-l-4 border-l-amber-500'
							: ''}"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h2 class="truncate font-semibold">{debt.contactName}</h2>
							{#if debt.contactPhone}<p class="text-xs text-muted-foreground">
									{debt.contactPhone}
								</p>{/if}
						</div>
						<span class="shrink-0 rounded-full px-2 py-1 text-xs font-medium {dueState.badgeClass}"
							>{dueState.label}</span
						>
					</div>
					<div class="mt-4 grid grid-cols-2 gap-3">
						<div>
							<p class="text-xs text-muted-foreground">Sisa</p>
							<p
								class="text-lg font-semibold {debt.type === 'piutang'
									? 'text-green-700'
									: 'text-red-700'}"
							>
								{formatRupiah(debt.remainingAmount)}
							</p>
						</div>
						<div>
							<p class="text-xs text-muted-foreground">Jatuh tempo</p>
							<p class="text-sm font-medium">
								{debt.dueDate ? formatDate(debt.dueDate) : 'Tidak ditentukan'}
							</p>
						</div>
					</div>
					<div class="mt-4 flex items-center justify-between gap-3 border-t pt-3">
						<p class="text-xs text-muted-foreground">Awal {formatRupiah(debt.originalAmount)}</p>
						<a
							href={getDebtDetailHref(debt.id, query)}
							class="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
							>{nextAction(debt.type, paid)}<ChevronRight class="h-4 w-4" /></a
						>
					</div>
				</article>
			{/each}
		</div>

		<div class="hidden overflow-hidden rounded-xl border bg-card md:block">
			<table class="w-full">
				<thead class="border-b bg-muted/50"
					><tr
						><th
							scope="col"
							class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Kontak</th
						><th
							scope="col"
							class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Jumlah awal</th
						><th
							scope="col"
							class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Sisa</th
						><th
							scope="col"
							class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Tenggat</th
						><th
							scope="col"
							class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Tindakan</th
						></tr
					></thead
				>
				<tbody class="divide-y">
					{#each data.debts as debt (debt.id)}
						{@const dueState = getDebtDueState(debt, data.today)}
						{@const paid = dueState.kind === 'paid'}
						<tr class="hover:bg-muted/30"
							><td class="px-4 py-3"
								><a href={getDebtDetailHref(debt.id, query)} class="font-medium hover:underline"
									>{debt.contactName}</a
								>{#if debt.contactPhone}<p class="text-xs text-muted-foreground">
										{debt.contactPhone}
									</p>{/if}</td
							><td class="px-4 py-3 text-right">{formatRupiah(debt.originalAmount)}</td><td
								class="px-4 py-3 text-right font-semibold">{formatRupiah(debt.remainingAmount)}</td
							><td class="px-4 py-3"
								><span
									class="inline-flex rounded-full px-2 py-1 text-xs font-medium {dueState.badgeClass}"
									>{dueState.label}</span
								>
								<p class="mt-1 text-xs text-muted-foreground">
									{debt.dueDate ? formatDate(debt.dueDate) : 'Tidak ditentukan'}
								</p></td
							><td class="px-4 py-3 text-right"
								><a
									href={getDebtDetailHref(debt.id, query)}
									class="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
									>{nextAction(debt.type, paid)}<ChevronRight class="h-4 w-4" /></a
								></td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center"
		>
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<FileText class="h-8 w-8 text-muted-foreground" />
			</div>
			<h2 class="mb-2 text-lg font-medium">
				{hasFilters ? 'Tidak ada catatan yang cocok' : `Belum ada ${typeLabel(query.type)}`}
			</h2>
			<p class="mb-6 max-w-md text-sm text-muted-foreground">
				{hasFilters
					? 'Ubah atau hapus filter untuk melihat catatan lain.'
					: `Catat ${typeLabel(query.type).toLocaleLowerCase('id-ID')} pertama agar tenggat dan pembayarannya dapat dipantau.`}
			</p>
			{#if hasFilters}<a
					href={getDebtHref(query, { status: 'outstanding', due: 'all', q: '', sort: 'urgency' })}
					class="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary"
					>Hapus filter</a
				>{:else}<button
					type="button"
					onclick={() => openCreateModal(query.type)}
					class="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
					><Plus class="h-4 w-4" />Tambah {typeLabel(query.type)}</button
				>{/if}
		</div>
	{/if}
</div>

{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="debt-modal-title"
		tabindex="-1"
		onclick={(event) => event.target === event.currentTarget && closeModal()}
		onkeydown={(event) => event.key === 'Escape' && closeModal()}
	>
		<div
			class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-6 shadow-xl"
		>
			<div class="mb-6 flex items-center justify-between gap-3">
				<div>
					<h2 id="debt-modal-title" class="text-lg font-semibold">
						Tambah {typeLabel(createType)}
					</h2>
					<p class="text-xs text-muted-foreground">
						{createType === 'piutang'
							? 'Uang yang harus diterima usaha Anda.'
							: 'Uang yang harus dibayar usaha Anda.'}
					</p>
				</div>
				<button
					type="button"
					onclick={closeModal}
					disabled={loading}
					class="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
					aria-label="Tutup"><X class="h-5 w-5" /></button
				>
			</div>
			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-2">
					<label for="debt-contact" class="text-sm font-medium"
						>Nama kontak <span class="text-destructive">*</span></label
					><input
						id="debt-contact"
						type="text"
						bind:value={contactName}
						maxlength="200"
						placeholder={createType === 'piutang' ? 'Contoh: Budi Santoso' : 'Contoh: Toko Makmur'}
						class="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						required
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<label for="debt-phone" class="text-sm font-medium"
							>Nomor telepon <span class="font-normal text-muted-foreground">(opsional)</span
							></label
						><input
							id="debt-phone"
							type="tel"
							bind:value={contactPhone}
							maxlength="20"
							placeholder="0812-3456-7890"
							class="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
					<div class="space-y-2">
						<label for="debt-address" class="text-sm font-medium"
							>Alamat <span class="font-normal text-muted-foreground">(opsional)</span></label
						><input
							id="debt-address"
							type="text"
							bind:value={contactAddress}
							maxlength="500"
							class="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
				</div>
				<div class="space-y-2">
					<label for="debt-amount" class="text-sm font-medium"
						>Jumlah <span class="text-destructive">*</span></label
					><input
						id="debt-amount"
						type="number"
						bind:value={amount}
						min="1"
						step="1"
						inputmode="numeric"
						placeholder="1000000"
						class="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						required
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<label for="debt-date" class="text-sm font-medium"
							>Tanggal pencatatan <span class="text-destructive">*</span></label
						><input
							id="debt-date"
							type="date"
							bind:value={date}
							max={todayInJakarta()}
							class="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							required
						/>
					</div>
					<div class="space-y-2">
						<label for="debt-due-date" class="text-sm font-medium"
							>Jatuh tempo <span class="font-normal text-muted-foreground">(opsional)</span></label
						><input
							id="debt-due-date"
							type="date"
							bind:value={dueDate}
							min={date}
							class="min-h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
					</div>
				</div>
				<div class="space-y-2">
					<label for="debt-description" class="text-sm font-medium"
						>Keterangan <span class="font-normal text-muted-foreground">(opsional)</span></label
					><textarea
						id="debt-description"
						bind:value={description}
						maxlength="500"
						rows="3"
						placeholder="Konteks tagihan atau kesepakatan pembayaran"
						class="w-full resize-none rounded-md border bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					></textarea>
				</div>
				{#if formError}<div
						class="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
						role="alert"
					>
						<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />{formError}
					</div>{/if}
				<div class="grid grid-cols-2 gap-3 pt-2">
					<button
						type="button"
						onclick={closeModal}
						disabled={loading}
						class="min-h-12 rounded-md border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
						>Batal</button
					><button
						type="submit"
						disabled={loading}
						class="min-h-12 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>{loading ? 'Menyimpan…' : `Simpan ${typeLabel(createType)}`}</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}

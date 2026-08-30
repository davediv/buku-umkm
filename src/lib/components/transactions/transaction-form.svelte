<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Check, Link, X } from '@lucide/svelte';
	import { todayInJakarta } from '$lib/shared/dates';
	import { formatIdr } from '$lib/utils';
	import { Dialog } from '$lib/components/ui/dialog';

	interface TransactionFormCategory {
		id: string;
		name: string;
		icon?: string | null;
		color?: string | null;
	}

	interface TransactionFormAccount {
		id: string;
		name: string;
		code: string;
	}

	interface TransactionFormTemplate {
		id: string;
		name: string;
		type: string;
		categoryId: string | null;
		description: string | null;
	}

	type Props = {
		formId: string;
		mode: 'create' | 'edit';
		type: 'income' | 'expense';
		amount: string;
		categoryId: string;
		accountId: string;
		date: string;
		description: string;
		referenceNumber: string;
		notes: string;
		categoriesByType: {
			income: TransactionFormCategory[];
			expense: TransactionFormCategory[];
		};
		accounts: TransactionFormAccount[];
		templates?: TransactionFormTemplate[];
		returnTo: string;
		busy?: boolean;
		submitLabel: string;
		onsubmit: (event: SubmitEvent) => void | Promise<void>;
		notice?: Snippet;
		attachments?: Snippet;
	};

	let {
		formId,
		mode,
		type = $bindable(),
		amount = $bindable(),
		categoryId = $bindable(),
		accountId = $bindable(),
		date = $bindable(),
		description = $bindable(),
		referenceNumber = $bindable(),
		notes = $bindable(),
		categoriesByType,
		accounts,
		templates = [],
		returnTo,
		busy = false,
		submitLabel,
		onsubmit,
		notice,
		attachments
	}: Props = $props();

	let showCategoryPicker = $state(false);
	let showAccountPicker = $state(false);
	let categories = $derived(type === 'income' ? categoriesByType.income : categoriesByType.expense);
	let selectedCategory = $derived(categories.find((category) => category.id === categoryId));
	let selectedAccount = $derived(accounts.find((account) => account.id === accountId));
	let filteredTemplates = $derived(templates.filter((template) => template.type === type));

	const quickAmounts = [10_000, 25_000, 50_000, 100_000, 200_000, 500_000];
	const maxDate = todayInJakarta();

	function dependencyHref(pathname: string): string {
		return `${pathname}?${new URLSearchParams({ return_to: returnTo }).toString()}`;
	}

	function changeType(nextType: 'income' | 'expense') {
		if (mode === 'edit' || nextType === type) return;
		type = nextType;
		categoryId = '';
	}

	function handleAmountInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		amount = input.value.replace(/\D/g, '');
	}

	function handleAmountBlur() {
		if (amount) amount = formatIdr(amount);
	}

	function handleAmountFocus() {
		amount = amount.replace(/\./g, '');
	}

	function applyTemplate(template: TransactionFormTemplate) {
		if (template.type === 'income' || template.type === 'expense') type = template.type;
		if (template.categoryId) categoryId = template.categoryId;
		if (template.description) description = template.description;
	}
</script>

<form id={formId} {onsubmit} class="flex flex-1 flex-col gap-5 p-4">
	{#if notice}{@render notice()}{/if}

	<fieldset class="space-y-2">
		<legend class="sr-only">Jenis transaksi</legend>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => changeType('income')}
				disabled={mode === 'edit'}
				aria-pressed={type === 'income'}
				class="min-h-12 flex-1 rounded-lg font-medium transition-colors {type === 'income'
					? 'bg-green-600 text-white'
					: 'bg-muted text-muted-foreground hover:bg-secondary'} disabled:cursor-not-allowed disabled:opacity-80"
			>
				Pemasukan
			</button>
			<button
				type="button"
				onclick={() => changeType('expense')}
				disabled={mode === 'edit'}
				aria-pressed={type === 'expense'}
				class="min-h-12 flex-1 rounded-lg font-medium transition-colors {type === 'expense'
					? 'bg-red-600 text-white'
					: 'bg-muted text-muted-foreground hover:bg-secondary'} disabled:cursor-not-allowed disabled:opacity-80"
			>
				Pengeluaran
			</button>
		</div>
		{#if mode === 'edit'}
			<p class="text-xs text-muted-foreground">Jenis tidak dapat diubah setelah saldo tercatat.</p>
		{/if}
	</fieldset>

	<div class="space-y-2">
		<label for="{formId}-amount" class="text-sm font-medium text-muted-foreground">
			Jumlah <span class="text-destructive">*</span>
		</label>
		<div class="relative">
			<span
				class="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-muted-foreground"
				>Rp</span
			>
			<input
				id="{formId}-amount"
				type="text"
				inputmode="numeric"
				bind:value={amount}
				oninput={handleAmountInput}
				onblur={handleAmountBlur}
				onfocus={handleAmountFocus}
				placeholder="0"
				class="w-full rounded-xl bg-muted py-4 pl-14 pr-4 text-3xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				required
			/>
		</div>
		{#if mode === 'create'}
			<div class="flex flex-wrap gap-2 pt-1" aria-label="Pilihan jumlah cepat">
				{#each quickAmounts as quickAmount (quickAmount)}
					<button
						type="button"
						onclick={() => (amount = String(quickAmount))}
						class="min-h-11 rounded-full bg-muted px-4 text-sm transition-colors hover:bg-secondary"
					>
						{quickAmount.toLocaleString('id-ID')}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if mode === 'create'}
		<section class="space-y-2" aria-labelledby="quick-template-title">
			<div class="flex items-center justify-between gap-3">
				<h2 id="quick-template-title" class="text-sm font-medium text-muted-foreground">
					Template cepat
				</h2>
				<a
					href={dependencyHref('/pengaturan/template')}
					class="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
				>
					<Link class="h-3 w-3" />Kelola template
				</a>
			</div>
			{#if filteredTemplates.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each filteredTemplates as template (template.id)}
						<button
							type="button"
							onclick={() => applyTemplate(template)}
							class="min-h-11 rounded-full bg-secondary px-4 text-sm font-medium hover:bg-secondary/80"
						>
							{template.name}
						</button>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Belum ada template untuk jenis transaksi ini.</p>
			{/if}
		</section>
	{/if}

	<div class="space-y-2">
		<label for="{formId}-category" class="text-sm font-medium text-muted-foreground">Kategori</label
		>
		<button
			id="{formId}-category"
			type="button"
			onclick={() => (showCategoryPicker = true)}
			aria-haspopup="dialog"
			class="flex min-h-12 w-full items-center gap-3 rounded-lg bg-muted p-3 text-left transition-colors hover:bg-secondary"
		>
			{#if selectedCategory}
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full text-lg text-white"
					style="background-color: {selectedCategory.color || '#6b7280'}"
					>{selectedCategory.icon || '📁'}</span
				>
				<span class="flex-1 font-medium">{selectedCategory.name}</span>
			{:else}
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600"
					>?</span
				>
				<span class="flex-1 text-muted-foreground">Pilih kategori</span>
			{/if}
		</button>
	</div>

	<div class="space-y-2">
		<label for="{formId}-account" class="text-sm font-medium text-muted-foreground">
			Kas atau rekening <span class="text-destructive">*</span>
		</label>
		<button
			id="{formId}-account"
			type="button"
			onclick={() => mode === 'create' && (showAccountPicker = true)}
			disabled={mode === 'edit'}
			aria-haspopup={mode === 'create' ? 'dialog' : undefined}
			class="flex min-h-12 w-full items-center gap-3 rounded-lg bg-muted p-3 text-left transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-80"
		>
			{#if selectedAccount}
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700"
					>💳</span
				>
				<span class="flex-1">
					<span class="block font-medium">{selectedAccount.name}</span>
					<span class="block text-xs text-muted-foreground">Kode: {selectedAccount.code}</span>
				</span>
			{:else}
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600"
					>?</span
				>
				<span class="flex-1 text-muted-foreground">Pilih kas atau rekening</span>
			{/if}
		</button>
		{#if mode === 'edit'}
			<p class="text-xs text-muted-foreground">
				Rekening tidak dapat dipindahkan setelah transaksi disimpan.
			</p>
		{/if}
	</div>

	<div class="space-y-2">
		<label for="{formId}-date" class="text-sm font-medium text-muted-foreground">Tanggal</label>
		<input
			id="{formId}-date"
			type="date"
			bind:value={date}
			max={maxDate}
			class="min-h-12 w-full rounded-lg bg-muted p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			required
		/>
	</div>

	<div class="space-y-2">
		<label for="{formId}-description" class="text-sm font-medium text-muted-foreground"
			>Keterangan <span class="font-normal">(opsional)</span></label
		>
		<input
			id="{formId}-description"
			type="text"
			bind:value={description}
			maxlength="500"
			placeholder="Contoh: Pembelian bahan baku"
			class="min-h-12 w-full rounded-lg bg-muted p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		/>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-2">
			<label for="{formId}-reference" class="text-sm font-medium text-muted-foreground"
				>Nomor referensi <span class="font-normal">(opsional)</span></label
			>
			<input
				id="{formId}-reference"
				type="text"
				bind:value={referenceNumber}
				maxlength="100"
				placeholder="Contoh: INV/001"
				class="min-h-12 w-full rounded-lg bg-muted p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			/>
		</div>
		<div class="space-y-2">
			<label for="{formId}-notes" class="text-sm font-medium text-muted-foreground"
				>Catatan <span class="font-normal">(opsional)</span></label
			>
			<textarea
				id="{formId}-notes"
				bind:value={notes}
				maxlength="1000"
				rows="2"
				placeholder="Catatan tambahan"
				class="w-full resize-none rounded-lg bg-muted p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			></textarea>
		</div>
	</div>

	{#if attachments}{@render attachments()}{/if}

	<div class="mt-auto border-t pt-4">
		<button
			type="submit"
			disabled={busy}
			class="min-h-12 w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
		>
			{busy ? 'Menyimpan…' : submitLabel}
		</button>
	</div>
</form>

<Dialog
	open={showCategoryPicker}
	onopenchange={(open) => (showCategoryPicker = open)}
	ariaLabel="Pilih kategori"
	overlayClass="z-[55] p-0 md:pl-64"
	class="flex h-full w-full max-w-none flex-col rounded-none border-0 bg-background p-0 shadow-none"
>
	<header class="flex items-center justify-between border-b bg-background px-4 py-3">
		<h2 class="text-lg font-semibold">Pilih Kategori</h2>
		<div class="flex items-center gap-2">
			<a
				href={dependencyHref('/kategori')}
				class="inline-flex min-h-11 items-center px-3 text-sm font-medium text-primary">Kelola</a
			>
			<button
				data-dialog-initial-focus
				type="button"
				onclick={() => (showCategoryPicker = false)}
				class="flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
				aria-label="Tutup"><X class="h-5 w-5" /></button
			>
		</div>
	</header>
	<div class="flex-1 overflow-y-auto p-4">
		{#if categories.length > 0}
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
				{#each categories as category (category.id)}
					<button
						type="button"
						onclick={() => {
							categoryId = category.id;
							showCategoryPicker = false;
						}}
						class="flex min-h-24 flex-col items-center gap-2 rounded-lg p-3 text-center hover:bg-secondary {categoryId ===
						category.id
							? 'bg-primary/10 ring-2 ring-primary'
							: ''}"
					>
						<span
							class="flex h-12 w-12 items-center justify-center rounded-full text-xl"
							style="background-color: {category.color || '#6b7280'}">{category.icon || '📁'}</span
						>
						<span class="line-clamp-2 text-xs font-medium">{category.name}</span>
						{#if categoryId === category.id}<Check class="h-4 w-4 text-primary" />{/if}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex min-h-64 flex-col items-center justify-center text-center">
				<p class="mb-4 text-muted-foreground">
					Belum ada kategori {type === 'income' ? 'pemasukan' : 'pengeluaran'}.
				</p>
				<a
					href={dependencyHref('/kategori')}
					class="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
					>Tambah kategori</a
				>
			</div>
		{/if}
	</div>
</Dialog>

<Dialog
	open={showAccountPicker}
	onopenchange={(open) => (showAccountPicker = open)}
	ariaLabel="Pilih kas atau rekening"
	overlayClass="z-[55] p-0 md:pl-64"
	class="flex h-full w-full max-w-none flex-col rounded-none border-0 bg-background p-0 shadow-none"
>
	<header class="flex items-center justify-between border-b bg-background px-4 py-3">
		<h2 class="text-lg font-semibold">Pilih Kas atau Rekening</h2>
		<div class="flex items-center gap-2">
			<a
				href={dependencyHref('/akun')}
				class="inline-flex min-h-11 items-center px-3 text-sm font-medium text-primary">Kelola</a
			>
			<button
				data-dialog-initial-focus
				type="button"
				onclick={() => (showAccountPicker = false)}
				class="flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
				aria-label="Tutup"><X class="h-5 w-5" /></button
			>
		</div>
	</header>
	<div class="flex-1 overflow-y-auto p-4">
		{#if accounts.length > 0}
			<div class="space-y-2">
				{#each accounts as account (account.id)}
					<button
						type="button"
						onclick={() => {
							accountId = account.id;
							showAccountPicker = false;
						}}
						class="flex min-h-14 w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-secondary {accountId ===
						account.id
							? 'bg-primary/10 ring-2 ring-primary'
							: ''}"
					>
						<span
							class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700"
							>💳</span
						>
						<span class="flex-1"
							><span class="block font-medium">{account.name}</span><span
								class="block text-xs text-muted-foreground">Kode: {account.code}</span
							></span
						>
						{#if accountId === account.id}<Check class="h-5 w-5 text-primary" />{/if}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex min-h-64 flex-col items-center justify-center text-center">
				<p class="mb-4 text-muted-foreground">Belum ada kas atau rekening aktif.</p>
				<a
					href={dependencyHref('/akun')}
					class="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
					>Tambah rekening</a
				>
			</div>
		{/if}
	</div>
</Dialog>

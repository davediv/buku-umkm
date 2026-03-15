<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		ArrowLeft,
		Check,
		Building2,
		Store,
		Wrench,
		Factory,
		Wallet,
		ChevronRight,
		ShoppingCart,
		MoreHorizontal
	} from '@lucide/svelte';
	import { createBusinessProfile } from '$lib/db/business-profile';
	import { createAccount } from '$lib/db/accounts';
	import { getBusinessTypeLabel } from '$lib/utils';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Get user ID from server data
	let userId = $derived(data.userId);

	// Wizard state
	let currentStep = $state(1);
	const totalSteps = 3;
	const steps = [0, 1, 2]; // Zero-indexed for progress indicator

	// Form data
	let businessName = $state('');
	let ownerName = $state('');
	let businessType = $state('');
	let accountName = $state('');
	let openingBalance = $state(0);

	// Validation errors
	let errors = $state<Record<string, string>>({});

	// Loading state
	let loading = $state(false);
	let completing = $state(false);

	// Business type options (with icons and descriptions for onboarding)
	// Must stay in sync with BUSINESS_TYPES in $lib/constants.ts
	const businessTypes = [
		{
			value: 'warung_makan',
			label: 'Warung Makan/Restoran',
			icon: Store,
			desc: 'Restoran, cafe, rumah makan'
		},
		{
			value: 'toko_kelontong',
			label: 'Toko Kelontong',
			icon: Building2,
			desc: 'Minimarket, toko kelontong, grosir'
		},
		{ value: 'jasa', label: 'Jasa', icon: Wrench, desc: 'Jasa service, konsultasi, freelancer' },
		{
			value: 'manufaktur',
			label: 'Manufaktur',
			icon: Factory,
			desc: 'Pabrik, produksi, crafting'
		},
		{
			value: 'toko_online',
			label: 'Toko Online',
			icon: ShoppingCart,
			desc: 'E-commerce, marketplace, dropship'
		},
		{
			value: 'lainnya',
			label: 'Lainnya',
			icon: MoreHorizontal,
			desc: 'Jenis bisnis lain yang tidak tercantum'
		}
	];

	// Selected account type (kas, bank, or piutang)
	let selectedAccountType = $state('kas');

	// Validation functions
	function validateStep1(): boolean {
		errors = {};
		if (!businessName.trim()) {
			errors.businessName = 'Nama bisnis wajib diisi';
		}
		if (!ownerName.trim()) {
			errors.ownerName = 'Nama pemilik wajib diisi';
		}
		return Object.keys(errors).length === 0;
	}

	function validateStep2(): boolean {
		errors = {};
		if (!businessType) {
			errors.businessType = 'Pilih jenis bisnis';
		}
		return Object.keys(errors).length === 0;
	}

	function validateStep3(): boolean {
		errors = {};
		if (!accountName.trim()) {
			errors.accountName = 'Nama akun wajib diisi';
		}
		if (openingBalance < 0) {
			errors.openingBalance = 'Saldo tidak boleh negatif';
		}
		return Object.keys(errors).length === 0;
	}

	function nextStep() {
		if (currentStep === 1 && validateStep1()) {
			currentStep = 2;
		} else if (currentStep === 2 && validateStep2()) {
			currentStep = 3;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
			errors = {};
		}
	}

	async function skipOnboarding() {
		loading = true;
		try {
			// Save flag to localStorage that onboarding is skipped
			localStorage.setItem('onboarding_skipped', 'true');
			await goto('/beranda');
		} finally {
			loading = false;
		}
	}

	async function completeOnboarding() {
		if (!validateStep3()) return;
		if (!userId) {
			errors.submit = 'Sesi berakhir. Silakan login ulang.';
			return;
		}

		completing = true;
		try {
			// Step 1 & 2: Create business profile
			await createBusinessProfile({
				userId,
				name: businessName,
				ownerName: ownerName,
				businessType: businessType
			});

			// Step 3: Create first account with opening balance
			await createAccount({
				userId,
				code: '1101',
				name: accountName,
				type: 'asset',
				subType: selectedAccountType,
				isSystem: true,
				balance: openingBalance
			});

			// Mark onboarding as complete
			localStorage.setItem('onboarding_completed', 'true');
			localStorage.removeItem('onboarding_skipped');

			// Redirect to dashboard
			await goto('/beranda');
		} catch (error) {
			console.error('Failed to complete onboarding:', error);
			errors.submit = 'Gagal menyimpan data. Silakan coba lagi.';
		} finally {
			completing = false;
		}
	}

	// Computed properties
	let canProceedStep1 = $derived(businessName.trim() && ownerName.trim());
	let canProceedStep2 = $derived(!!businessType);
	let canFinish = $derived(accountName.trim() && openingBalance >= 0);
</script>

<svelte:head>
	<title>Setup Bisnis - Buku UMKM</title>
</svelte:head>

<div class="relative min-h-screen flex flex-col bg-background">
	<!-- Decorative background -->
	<div
		class="pointer-events-none fixed inset-0 -z-10"
		style="background: radial-gradient(ellipse 80% 60% at 50% -20%, hsl(16 70% 38% / 0.06), transparent);"
	></div>

	<!-- Header -->
	<header class="px-4 py-6 flex items-center justify-between">
		<div class="flex items-center gap-2.5">
			<div class="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
				<span class="text-primary-foreground font-bold text-sm">B</span>
			</div>
			<span class="font-bold text-lg tracking-tight">Buku UMKM</span>
		</div>
		<Button variant="ghost" size="sm" onclick={skipOnboarding} disabled={loading || completing}>
			{t('onboarding.skip')}
		</Button>
	</header>

	<!-- Progress Indicator -->
	<div class="px-4 mb-6">
		<div class="flex items-center justify-center gap-2">
			{#each steps as i (i)}
				{@const stepNum = i + 1}
				<div class="flex items-center">
					<div
						class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
						{stepNum < currentStep
							? 'bg-primary text-primary-foreground'
							: stepNum === currentStep
								? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
								: 'bg-muted text-muted-foreground'}"
					>
						{#if stepNum < currentStep}
							<Check class="w-4 h-4" />
						{:else}
							{stepNum}
						{/if}
					</div>
					{#if i < totalSteps - 1}
						<div
							class="w-8 h-0.5 mx-1 transition-colors {stepNum < currentStep
								? 'bg-primary'
								: 'bg-muted'}"
						></div>
					{/if}
				</div>
			{/each}
		</div>
		<p class="text-center text-sm text-muted-foreground mt-2">
			Langkah {currentStep} dari {totalSteps}
		</p>
	</div>

	<!-- Main Content -->
	<main class="flex-1 px-4 pb-8">
		<div class="max-w-md mx-auto">
			<!-- Step 1: Business Info -->
			{#if currentStep === 1}
				<div class="space-y-6 animate-in slide-in-from-right-4 duration-300">
					<div class="text-center space-y-2">
						<h1 class="text-2xl font-bold">{t('onboarding.step1Title')}</h1>
						<p class="text-muted-foreground">{t('onboarding.step1Desc')}</p>
					</div>

					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="businessName">Nama Bisnis</Label>
							<Input
								id="businessName"
								type="text"
								placeholder="Contoh: Toko Saya"
								bind:value={businessName}
								error={!!errors.businessName}
							/>
							{#if errors.businessName}
								<p class="text-sm text-destructive">{errors.businessName}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="ownerName">Nama Pemilik</Label>
							<Input
								id="ownerName"
								type="text"
								placeholder="Contoh: Budi Santoso"
								bind:value={ownerName}
								error={!!errors.ownerName}
							/>
							{#if errors.ownerName}
								<p class="text-sm text-destructive">{errors.ownerName}</p>
							{/if}
						</div>
					</div>

					<div class="flex gap-3">
						<Button variant="outline" class="flex-1" onclick={skipOnboarding} disabled={loading}>
							{t('onboarding.skip')}
						</Button>
						<Button class="flex-1" onclick={nextStep} disabled={!canProceedStep1}>
							{t('onboarding.next')}
							<ChevronRight class="w-4 h-4 ml-1" />
						</Button>
					</div>
				</div>
			{/if}

			<!-- Step 2: Business Type -->
			{#if currentStep === 2}
				<div class="space-y-6 animate-in slide-in-from-right-4 duration-300">
					<div class="text-center space-y-2">
						<h1 class="text-2xl font-bold">{t('onboarding.step2Title')}</h1>
						<p class="text-muted-foreground">Pilih jenis bisnis Anda</p>
					</div>

					<div class="space-y-3">
						{#each businessTypes as type (type.value)}
							<button
								type="button"
								class="w-full p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50
								{businessType === type.value
									? 'border-primary bg-primary/5'
									: 'border-border hover:bg-secondary/50'}"
								onclick={() => (businessType = type.value)}
							>
								<div class="flex items-center gap-3">
									<div
										class="w-10 h-10 rounded-full flex items-center justify-center
										{businessType === type.value ? 'bg-primary text-primary-foreground' : 'bg-secondary'}"
									>
										<type.icon class="w-5 h-5" />
									</div>
									<div class="flex-1">
										<p class="font-medium">{type.label}</p>
										<p class="text-sm text-muted-foreground">{type.desc}</p>
									</div>
									{#if businessType === type.value}
										<Check class="w-5 h-5 text-primary" />
									{/if}
								</div>
							</button>
						{/each}
					</div>

					{#if errors.businessType}
						<p class="text-sm text-destructive text-center">{errors.businessType}</p>
					{/if}

					<div class="flex gap-3">
						<Button variant="outline" class="flex-1" onclick={prevStep}>
							<ArrowLeft class="w-4 h-4 mr-1" />
							{t('onboarding.previous')}
						</Button>
						<Button class="flex-1" onclick={nextStep} disabled={!canProceedStep2}>
							{t('onboarding.next')}
							<ChevronRight class="w-4 h-4 ml-1" />
						</Button>
					</div>
				</div>
			{/if}

			<!-- Step 3: First Account -->
			{#if currentStep === 3}
				<div class="space-y-6 animate-in slide-in-from-right-4 duration-300">
					<div class="text-center space-y-2">
						<h1 class="text-2xl font-bold">{t('onboarding.step3Title')}</h1>
						<p class="text-muted-foreground">Buat akun kas pertama Anda</p>
					</div>

					<!-- Business Summary -->
					<div class="p-4 rounded-lg bg-secondary/50 border">
						<div class="flex items-center gap-3">
							<Wallet class="w-8 h-8 text-primary" />
							<div>
								<p class="font-medium">{businessName}</p>
								<p class="text-sm text-muted-foreground">
									{getBusinessTypeLabel(businessType)}
								</p>
							</div>
						</div>
					</div>

					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="accountName">Nama Akun</Label>
							<Input
								id="accountName"
								type="text"
								placeholder="Contoh: Kas Toko"
								bind:value={accountName}
								error={!!errors.accountName}
							/>
							{#if errors.accountName}
								<p class="text-sm text-destructive">{errors.accountName}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="openingBalance">Saldo Awal (Rp)</Label>
							<Input
								id="openingBalance"
								type="number"
								placeholder="0"
								bind:value={openingBalance}
								error={!!errors.openingBalance}
								min="0"
							/>
							<p class="text-sm text-muted-foreground">
								Masukkan saldo uang tunai yang ada saat ini
							</p>
							{#if errors.openingBalance}
								<p class="text-sm text-destructive">{errors.openingBalance}</p>
							{/if}
						</div>
					</div>

					{#if errors.submit}
						<div
							class="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm"
						>
							{errors.submit}
						</div>
					{/if}

					<div class="flex gap-3">
						<Button variant="outline" class="flex-1" onclick={prevStep} disabled={completing}>
							<ArrowLeft class="w-4 h-4 mr-1" />
							{t('onboarding.previous')}
						</Button>
						<Button class="flex-1" onclick={completeOnboarding} disabled={!canFinish || completing}>
							{#if completing}
								<span class="animate-spin mr-2">⏳</span>
							{:else}
								<Check class="w-4 h-4 mr-1" />
							{/if}
							{t('onboarding.finish')}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</main>

	<!-- Footer Tips -->
	<footer class="px-4 py-4 border-t">
		<div class="max-w-md mx-auto text-center text-sm text-muted-foreground">
			<p class="flex items-center justify-center gap-2">
				<span class="w-2 h-2 bg-green-500 rounded-full"></span>
				Data Anda tersimpan dengan aman di perangkat
			</p>
		</div>
	</footer>
</div>

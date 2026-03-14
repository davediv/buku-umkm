<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Download,
		Upload,
		Database,
		Calendar,
		AlertTriangle,
		CheckCircle,
		X,
		Loader2,
		Store,
		User,
		LogOut,
		Info,
		Shield,
		Settings,
		Building2,
		MapPin,
		Phone,
		FileText,
		Save,
		Eye,
		EyeOff
	} from '@lucide/svelte';
	import { APP_VERSION, BUSINESS_TYPES } from '$lib/constants';
	import { getBusinessTypeLabel } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let {
		data
	}: {
		data: {
			user: { email: string };
			profile: {
				id: string;
				name: string;
				businessType: string;
				address: string | null;
				phone: string | null;
				npwp: string | null;
				ownerName: string | null;
				industry: string | null;
			} | null;
		};
	} = $props();

	// State for tabs/sections
	let activeSection = $state<'profil' | 'akun' | 'backup' | 'tentang'>('profil');

	// Backup/restore state
	let backingUp = $state(false);
	let restoring = $state(false);
	let showRestoreConfirm = $state(false);
	let selectedFile = $state<File | null>(null);
	let restoreError = $state<string | null>(null);
	let lastBackupDate = $state<string | null>(null);
	let fileInputRef: HTMLInputElement;
	let localStorageInitialized = $state(false);

	// Business profile edit state
	let isEditingProfile = $state(false);
	let savingProfile = $state(false);
	let profileError = $state<string | null>(null);
	let profileSuccess = $state(false);

	// Derive profile form from data - only initialize when not editing
	let profileForm = $derived({
		name: data.profile?.name ?? '',
		businessType: data.profile?.businessType ?? '',
		address: data.profile?.address ?? '',
		phone: data.profile?.phone ?? '',
		npwp: data.profile?.npwp ?? '',
		ownerName: data.profile?.ownerName ?? '',
		industry: data.profile?.industry ?? ''
	});

	// Password change state
	let showPasswordForm = $state(false);
	let changingPassword = $state(false);
	let passwordForm = $state({
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	});
	let passwordError = $state<string | null>(null);
	let passwordSuccess = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);

	// Logout state
	let loggingOut = $state(false);

	// Initialize last backup date from localStorage (only once)
	$effect(() => {
		if (typeof window !== 'undefined' && !localStorageInitialized) {
			const stored = localStorage.getItem('lastBackupDate');
			if (stored) {
				lastBackupDate = stored;
			}
			localStorageInitialized = true;
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

	// Save business profile
	async function saveProfile() {
		if (!profileForm.name.trim()) {
			profileError = 'Nama usaha wajib diisi';
			return;
		}

		savingProfile = true;
		profileError = null;
		profileSuccess = false;

		try {
			const response = await fetch('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: profileForm.name,
					businessType: profileForm.businessType,
					address: profileForm.address || null,
					phone: profileForm.phone || null,
					npwp: profileForm.npwp || null,
					ownerName: profileForm.ownerName || null,
					industry: profileForm.industry || null
				})
			});

			const result = (await response.json()) as { error?: string };

			if (!response.ok) {
				throw new Error(result.error || 'Gagal menyimpan profil');
			}

			profileSuccess = true;
			isEditingProfile = false;
			await invalidateAll();

			setTimeout(() => {
				profileSuccess = false;
			}, 3000);
		} catch (error) {
			console.error('Error saving profile:', error);
			profileError = error instanceof Error ? error.message : 'Terjadi kesalahan';
		} finally {
			savingProfile = false;
		}
	}

	// Cancel profile editing
	function cancelProfileEdit() {
		if (data.profile) {
			profileForm = {
				name: data.profile.name ?? '',
				businessType: data.profile.businessType ?? '',
				address: data.profile.address ?? '',
				phone: data.profile.phone ?? '',
				npwp: data.profile.npwp ?? '',
				ownerName: data.profile.ownerName ?? '',
				industry: data.profile.industry ?? ''
			};
		}
		isEditingProfile = false;
		profileError = null;
	}

	// Change password
	async function changePassword() {
		if (
			!passwordForm.currentPassword ||
			!passwordForm.newPassword ||
			!passwordForm.confirmPassword
		) {
			passwordError = 'Semua kolom password wajib diisi';
			return;
		}

		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			passwordError = 'Password baru dan konfirmasi password tidak cocok';
			return;
		}

		if (passwordForm.newPassword.length < 6) {
			passwordError = 'Password minimal 6 karakter';
			return;
		}

		changingPassword = true;
		passwordError = null;
		passwordSuccess = false;

		try {
			// Note: This would require a password change API endpoint
			// For now, we'll show a message that this feature is not yet available
			throw new Error('Fitur ubah password belum tersedia. Silakan hubungi dukungan.');
		} catch (error) {
			console.error('Error changing password:', error);
			passwordError = error instanceof Error ? error.message : 'Terjadi kesalahan';
		} finally {
			changingPassword = false;
		}
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

	// Handle logout
	async function handleLogout() {
		loggingOut = true;
		try {
			const response = await fetch('/api/auth/signout', {
				method: 'POST'
			});

			// Only proceed if logout was successful
			if (response.ok) {
				// Clear local storage
				localStorage.removeItem('lastBackupDate');

				// Redirect to landing page
				await goto('/');
			} else {
				throw new Error('Logout failed');
			}
		} catch (error) {
			console.error('Logout error:', error);
			alert('Gagal logout. Silakan coba lagi.');
		} finally {
			loggingOut = false;
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
		<!-- Section Tabs -->
		<div class="flex gap-2 overflow-x-auto pb-2">
			<button
				type="button"
				onclick={() => (activeSection = 'profil')}
				class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors {activeSection ===
				'profil'
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
			>
				<Store class="w-4 h-4" />
				Profil Usaha
			</button>
			<button
				type="button"
				onclick={() => (activeSection = 'akun')}
				class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors {activeSection ===
				'akun'
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
			>
				<User class="w-4 h-4" />
				Akun Saya
			</button>
			<button
				type="button"
				onclick={() => (activeSection = 'backup')}
				class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors {activeSection ===
				'backup'
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
			>
				<Database class="w-4 h-4" />
				Cadangan
			</button>
			<button
				type="button"
				onclick={() => (activeSection = 'tentang')}
				class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors {activeSection ===
				'tentang'
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
			>
				<Info class="w-4 h-4" />
				Tentang
			</button>
		</div>

		<!-- Profile Section -->
		{#if activeSection === 'profil'}
			<section class="space-y-4">
				<div class="flex items-center gap-2">
					<Store class="w-5 h-5 text-primary" />
					<h2 class="text-lg font-semibold">Profil Usaha</h2>
				</div>

				<div class="p-4 bg-card rounded-lg border space-y-4">
					{#if isEditingProfile}
						<!-- Edit Mode -->
						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="businessName">Nama Usaha</Label>
								<Input
									id="businessName"
									type="text"
									placeholder="Contoh: Toko Saya"
									bind:value={profileForm.name}
								/>
							</div>

							<div class="space-y-2">
								<Label for="ownerName">Nama Pemilik</Label>
								<Input
									id="ownerName"
									type="text"
									placeholder="Contoh: Budi Santoso"
									bind:value={profileForm.ownerName}
								/>
							</div>

							<div class="space-y-2">
								<Label for="businessType">Jenis Bisnis</Label>
								<select
									id="businessType"
									bind:value={profileForm.businessType}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<option value="">Pilih jenis bisnis</option>
									{#each BUSINESS_TYPES as type (type.value)}
										<option value={type.value}>{type.label}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-2">
								<Label for="address">Alamat</Label>
								<Input
									id="address"
									type="text"
									placeholder="Contoh: Jl. Merdeka No. 10, Jakarta"
									bind:value={profileForm.address}
								/>
							</div>

							<div class="space-y-2">
								<Label for="phone">Telepon</Label>
								<Input
									id="phone"
									type="tel"
									placeholder="Contoh: 081234567890"
									bind:value={profileForm.phone}
								/>
							</div>

							<div class="space-y-2">
								<Label for="industry">Industri</Label>
								<Input
									id="industry"
									type="text"
									placeholder="Contoh: Makanan, Fashion, Teknologi"
									bind:value={profileForm.industry}
								/>
							</div>

							<div class="space-y-2">
								<Label for="npwp">NPWP</Label>
								<Input
									id="npwp"
									type="text"
									placeholder="Contoh: 01.234.567.8-901.000"
									bind:value={profileForm.npwp}
								/>
								<p class="text-xs text-muted-foreground">Format: 15 atau 16 digit</p>
							</div>

							{#if profileError}
								<div class="p-3 bg-destructive/10 border border-destructive rounded-lg">
									<p class="text-sm text-destructive">{profileError}</p>
								</div>
							{/if}

							{#if profileSuccess}
								<div
									class="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg"
								>
									<p class="text-sm text-green-800 dark:text-green-200">
										Profil berhasil disimpan!
									</p>
								</div>
							{/if}

							<div class="flex gap-3">
								<Button
									variant="outline"
									class="flex-1"
									onclick={cancelProfileEdit}
									disabled={savingProfile}
								>
									Batal
								</Button>
								<Button class="flex-1" onclick={saveProfile} disabled={savingProfile}>
									{#if savingProfile}
										<Loader2 class="w-4 h-4 mr-2 animate-spin" />
									{:else}
										<Save class="w-4 h-4 mr-2" />
									{/if}
									Simpan
								</Button>
							</div>
						</div>
					{:else}
						<!-- View Mode -->
						<div class="space-y-4">
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-3">
									<div class="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
										{#if data.profile?.name}
											<span class="text-2xl font-bold text-primary">
												{data.profile.name.charAt(0).toUpperCase()}
											</span>
										{:else}
											<Store class="w-8 h-8 text-primary" />
										{/if}
									</div>
									<div>
										<h3 class="font-semibold text-lg">{data.profile?.name ?? 'Belum diatur'}</h3>
										<p class="text-sm text-muted-foreground">
											{data.profile?.ownerName ?? 'Nama pemilik belum diisi'}
										</p>
									</div>
								</div>
								<Button variant="outline" size="sm" onclick={() => (isEditingProfile = true)}>
									<Settings class="w-4 h-4 mr-1" />
									Ubah
								</Button>
							</div>

							<div class="grid gap-3 pt-2">
								<div class="flex items-center gap-3 text-sm">
									<Building2 class="w-4 h-4 text-muted-foreground" />
									<span class="text-muted-foreground w-20">Jenis:</span>
									<span
										>{data.profile?.businessType
											? getBusinessTypeLabel(data.profile.businessType)
											: '-'}</span
									>
								</div>
								<div class="flex items-center gap-3 text-sm">
									<MapPin class="w-4 h-4 text-muted-foreground" />
									<span class="text-muted-foreground w-20">Alamat:</span>
									<span>{data.profile?.address ?? '-'}</span>
								</div>
								<div class="flex items-center gap-3 text-sm">
									<Phone class="w-4 h-4 text-muted-foreground" />
									<span class="text-muted-foreground w-20">Telepon:</span>
									<span>{data.profile?.phone ?? '-'}</span>
								</div>
								<div class="flex items-center gap-3 text-sm">
									<FileText class="w-4 h-4 text-muted-foreground" />
									<span class="text-muted-foreground w-20">NPWP:</span>
									<span>{data.profile?.npwp ?? '-'}</span>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Account Section -->
		{#if activeSection === 'akun'}
			<section class="space-y-4">
				<div class="flex items-center gap-2">
					<User class="w-5 h-5 text-primary" />
					<h2 class="text-lg font-semibold">Akun Saya</h2>
				</div>

				<div class="p-4 bg-card rounded-lg border space-y-4">
					<!-- Email -->
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input id="email" type="email" value={data.user.email} disabled />
						<p class="text-xs text-muted-foreground">Email tidak dapat diubah</p>
					</div>

					<!-- Change Password -->
					{#if !showPasswordForm}
						<Button variant="outline" onclick={() => (showPasswordForm = true)}>
							<Shield class="w-4 h-4 mr-2" />
							Ubah Password
						</Button>
					{:else}
						<div class="space-y-4 pt-2 border-t">
							<div class="space-y-2">
								<Label for="currentPassword">Password Saat Ini</Label>
								<div class="relative">
									<Input
										id="currentPassword"
										type={showCurrentPassword ? 'text' : 'password'}
										placeholder="Masukkan password saat ini"
										bind:value={passwordForm.currentPassword}
									/>
									<button
										type="button"
										class="absolute right-3 top-1/2 -translate-y-1/2"
										onclick={() => (showCurrentPassword = !showCurrentPassword)}
									>
										{#if showCurrentPassword}
											<EyeOff class="w-4 h-4 text-muted-foreground" />
										{:else}
											<Eye class="w-4 h-4 text-muted-foreground" />
										{/if}
									</button>
								</div>
							</div>

							<div class="space-y-2">
								<Label for="newPassword">Password Baru</Label>
								<div class="relative">
									<Input
										id="newPassword"
										type={showNewPassword ? 'text' : 'password'}
										placeholder="Masukkan password baru"
										bind:value={passwordForm.newPassword}
									/>
									<button
										type="button"
										class="absolute right-3 top-1/2 -translate-y-1/2"
										onclick={() => (showNewPassword = !showNewPassword)}
									>
										{#if showNewPassword}
											<EyeOff class="w-4 h-4 text-muted-foreground" />
										{:else}
											<Eye class="w-4 h-4 text-muted-foreground" />
										{/if}
									</button>
								</div>
							</div>

							<div class="space-y-2">
								<Label for="confirmPassword">Konfirmasi Password Baru</Label>
								<Input
									id="confirmPassword"
									type="password"
									placeholder="Masukkan kembali password baru"
									bind:value={passwordForm.confirmPassword}
								/>
							</div>

							{#if passwordError}
								<div class="p-3 bg-destructive/10 border border-destructive rounded-lg">
									<p class="text-sm text-destructive">{passwordError}</p>
								</div>
							{/if}

							{#if passwordSuccess}
								<div
									class="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg"
								>
									<p class="text-sm text-green-800 dark:text-green-200">
										Password berhasil diubah!
									</p>
								</div>
							{/if}

							<div class="flex gap-3">
								<Button
									variant="outline"
									class="flex-1"
									onclick={() => {
										showPasswordForm = false;
										passwordError = null;
										passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
									}}
									disabled={changingPassword}
								>
									Batal
								</Button>
								<Button class="flex-1" onclick={changePassword} disabled={changingPassword}>
									{#if changingPassword}
										<Loader2 class="w-4 h-4 mr-2 animate-spin" />
									{/if}
									Simpan Password
								</Button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Logout Button -->
				<div class="p-4 bg-card rounded-lg border">
					<Button variant="destructive" class="w-full" onclick={handleLogout} disabled={loggingOut}>
						{#if loggingOut}
							<Loader2 class="w-4 h-4 mr-2 animate-spin" />
						{:else}
							<LogOut class="w-4 h-4 mr-2" />
						{/if}
						Keluar
					</Button>
				</div>
			</section>
		{/if}

		<!-- Backup Section -->
		{#if activeSection === 'backup'}
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
							class="flex items-center justify-center gap-2 py-3 px-4 min-h-[48px] text-base bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
							class="flex items-center justify-center gap-2 py-3 px-4 min-h-[48px] text-base border rounded-lg font-medium hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
		{/if}

		<!-- About Section -->
		{#if activeSection === 'tentang'}
			<section class="space-y-4">
				<div class="flex items-center gap-2">
					<Info class="w-5 h-5 text-primary" />
					<h2 class="text-lg font-semibold">Tentang Aplikasi</h2>
				</div>

				<div class="p-4 bg-card rounded-lg border space-y-4">
					<div class="flex items-center gap-4">
						<div class="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
							<span class="text-3xl font-bold text-primary-foreground">B</span>
						</div>
						<div>
							<h3 class="font-semibold text-xl">Buku UMKM</h3>
							<p class="text-sm text-muted-foreground">Versi {APP_VERSION}</p>
						</div>
					</div>

					<p class="text-sm text-muted-foreground">
						Aplikasi bookkeeping gratis dan open-source untuk pelaku UMKM Indonesia. Dibuat dengan
						cinta untuk membantu pengelolaan keuangan bisnis Anda.
					</p>

					<div class="pt-2 border-t space-y-2">
						<p class="text-sm font-medium">Fitur Utama:</p>
						<ul class="text-sm text-muted-foreground space-y-1">
							<li>- Pencatatan transaksi pemasukan dan pengeluaran</li>
							<li>- Manajemen hutang dan piutang</li>
							<li>- Perhitungan pajak PPh Final 0.5%</li>
							<li>- Laporan keuangan (laba-rugi, neraca)</li>
							<li>- Backup dan restore data</li>
						</ul>
					</div>
				</div>

				<!-- Tax Disclaimer -->
				<div
					class="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg"
				>
					<div class="flex items-start gap-3">
						<AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
						<div class="text-sm text-amber-800 dark:text-amber-200">
							<p class="font-medium">Disclaimer Pajak</p>
							<p class="mt-1">
								Perhitungan pajak dalam aplikasi ini bersifat membantu dan tidak menggantikan
								perhitungan resmi dari pajak atau akuntan profesional. Pastikan untuk selalu
								mengkonsultasikan dengan pajak atau akuntan terpercaya untuk kepatuhan pajak Anda.
							</p>
						</div>
					</div>
				</div>
			</section>
		{/if}
	</div>

	<!-- Footer -->
	<footer class="px-4 py-4 border-t text-center">
		<p class="text-sm text-muted-foreground">Dibuat dengan cinta untuk UMKM Indonesia</p>
		<p class="text-xs text-muted-foreground mt-1">Buku UMKM v{APP_VERSION}</p>
	</footer>
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
						class="flex-1 py-3 min-h-[48px] text-base border rounded-lg font-medium hover:bg-secondary transition-colors"
					>
						Batal
					</button>
					<button
						type="button"
						onclick={confirmRestore}
						disabled={restoring}
						class="flex-1 py-3 min-h-[48px] text-base bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

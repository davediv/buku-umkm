<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let loading = $state(false);
</script>

<svelte:head>
	<title>Daftar - Buku UMKM</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-background p-4">
	<div class="w-full max-w-sm space-y-6">
		<!-- Header -->
		<div class="text-center space-y-2">
			<h1 class="text-2xl font-bold tracking-tight">{t('auth.createAccount')}</h1>
			<p class="text-sm text-muted-foreground">Buat akun untuk memulai menggunakan Buku UMKM</p>
		</div>

		<!-- Error Message -->
		{#if form?.message}
			<div
				class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md"
			>
				{form.message}
			</div>
		{/if}

		<!-- Registration Form -->
		<form
			method="post"
			action="?/signUpEmail"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
			class="space-y-4"
		>
			<div class="space-y-2">
				<Label for="name">{t('common.name')}</Label>
				<Input
					id="name"
					name="name"
					type="text"
					placeholder="Nama Lengkap"
					value={form?.values?.name ?? ''}
					error={!!form?.errors?.name}
					disabled={loading}
					autocomplete="name"
					required
				/>
				{#if form?.errors?.name}
					<p class="text-sm text-destructive">{form.errors.name}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="email">{t('common.email')}</Label>
				<Input
					id="email"
					name="email"
					type="email"
					placeholder={t('auth.emailPlaceholder')}
					value={form?.values?.email ?? ''}
					error={!!form?.errors?.email}
					disabled={loading}
					autocomplete="email"
					required
				/>
				{#if form?.errors?.email}
					<p class="text-sm text-destructive">{form.errors.email}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="password">{t('common.password')}</Label>
				<Input
					id="password"
					name="password"
					type="password"
					placeholder={t('auth.passwordPlaceholder')}
					error={!!form?.errors?.password}
					disabled={loading}
					autocomplete="new-password"
					required
				/>
				{#if form?.errors?.password}
					<p class="text-sm text-destructive">{form.errors.password}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="confirmPassword">{t('auth.confirmPassword')}</Label>
				<Input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					placeholder="Masukkan ulang kata sandi"
					error={!!form?.errors?.confirmPassword}
					disabled={loading}
					autocomplete="new-password"
					required
				/>
				{#if form?.errors?.confirmPassword}
					<p class="text-sm text-destructive">{form.errors.confirmPassword}</p>
				{/if}
			</div>

			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? t('common.loading') : t('auth.register')}
			</Button>
		</form>

		<!-- Login Link -->
		<p class="text-center text-sm text-muted-foreground">
			{t('auth.hasAccount')}
			<a href="/masuk" class="text-primary hover:underline font-medium"> {t('auth.login')}</a>
		</p>
	</div>
</div>

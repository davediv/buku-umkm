<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { BookOpen } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let loading = $state(false);
</script>

<svelte:head>
	<title>Daftar - Buku UMKM</title>
</svelte:head>

<div class="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
	<!-- Decorative background -->
	<div
		class="pointer-events-none fixed inset-0 -z-10"
		style="background: radial-gradient(ellipse 70% 50% at 50% 0%, hsl(16 70% 38% / 0.05), transparent);"
	></div>

	<div class="w-full max-w-sm space-y-8">
		<!-- Logo -->
		<div class="flex justify-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20"
			>
				<BookOpen class="h-6 w-6 text-primary-foreground" />
			</div>
		</div>

		<!-- Header -->
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-bold tracking-tight">{t('auth.createAccount')}</h1>
			<p class="text-sm text-muted-foreground">Buat akun untuk memulai menggunakan Buku UMKM</p>
		</div>

		<!-- Error Message -->
		{#if form?.message}
			<div
				class="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
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
			<a href="/masuk" class="font-medium text-primary hover:underline"> {t('auth.login')}</a>
		</p>
	</div>
</div>

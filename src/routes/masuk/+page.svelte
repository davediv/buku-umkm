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
	<title>Masuk - Buku UMKM</title>
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
			<h1 class="text-2xl font-bold tracking-tight">{t('auth.welcomeBack')}</h1>
			<p class="text-sm text-muted-foreground">Masuk ke akun Buku UMKM Anda</p>
		</div>

		<!-- Error Message -->
		{#if form?.message}
			<div
				class="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
			>
				{form.message}
			</div>
		{/if}

		<!-- Login Form -->
		<form
			method="post"
			action="?/signInEmail"
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
					autocomplete="current-password"
					required
				/>
				{#if form?.errors?.password}
					<p class="text-sm text-destructive">{form.errors.password}</p>
				{/if}
			</div>

			<Button type="submit" class="w-full" disabled={loading}>
				{loading ? t('common.loading') : t('auth.login')}
			</Button>
		</form>

		<!-- Register Link -->
		<p class="text-center text-sm text-muted-foreground">
			{t('auth.noAccount')}
			<a href="/daftar" class="font-medium text-primary hover:underline"> {t('auth.register')}</a>
		</p>
	</div>
</div>

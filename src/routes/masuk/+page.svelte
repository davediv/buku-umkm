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
	<title>Masuk - Buku UMKM</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-background p-4">
	<div class="w-full max-w-sm space-y-6">
		<!-- Header -->
		<div class="text-center space-y-2">
			<h1 class="text-2xl font-bold tracking-tight">{t('auth.welcomeBack')}</h1>
			<p class="text-sm text-muted-foreground">Masuk ke akun Buku UMKM Anda</p>
		</div>

		<!-- Error Message -->
		{#if form?.message}
			<div
				class="bg-destructive/10 border border-destructive text-destructive text-sm p-3 rounded-md"
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
			<a href="/daftar" class="text-primary hover:underline font-medium"> {t('auth.register')}</a>
		</p>
	</div>
</div>

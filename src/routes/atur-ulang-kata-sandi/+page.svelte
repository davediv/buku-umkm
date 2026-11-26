<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ArrowLeft, KeyRound, Link2Off } from '@lucide/svelte';
	import { PASSWORD_MIN_LENGTH } from '$lib/shared/password';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';
	import { validateNewPassword, type NewPasswordErrors } from './new-password';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	let clientErrors = $state<NewPasswordErrors>({});

	let linkUnusable = $derived(!data.token || !!form?.invalidToken);
	let passwordError = $derived(clientErrors.password ?? form?.errors?.password);
	let confirmError = $derived(clientErrors.confirmPassword ?? form?.errors?.confirmPassword);

	const submit: SubmitFunction = ({ formData, cancel }) => {
		clientErrors = validateNewPassword(
			String(formData.get('password') ?? ''),
			String(formData.get('confirmPassword') ?? '')
		);
		if (Object.keys(clientErrors).length > 0) {
			cancel();
			return;
		}
		loading = true;
		return async ({ update }) => {
			loading = false;
			await update();
		};
	};
</script>

<svelte:head>
	<title>Atur Ulang Kata Sandi - Buku UMKM</title>
	<meta name="robots" content="noindex" />
	<!-- The URL carries the reset token; never pass it on in a Referer. -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main
	id="main-content"
	tabindex="-1"
	class="relative flex min-h-screen flex-col items-center justify-center bg-background p-4"
>
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
				{#if linkUnusable}
					<Link2Off class="h-6 w-6 text-primary-foreground" />
				{:else}
					<KeyRound class="h-6 w-6 text-primary-foreground" />
				{/if}
			</div>
		</div>

		{#if linkUnusable}
			<div class="space-y-2 text-center">
				<h1 class="text-2xl font-bold tracking-tight">Tautan tidak berlaku</h1>
				<p class="text-sm text-muted-foreground">
					Tautan atur ulang kata sandi ini sudah kedaluwarsa, sudah pernah dipakai, atau tidak
					lengkap. Minta tautan baru untuk melanjutkan.
				</p>
			</div>

			<a href="/lupa-kata-sandi" class={buttonVariants({ class: 'w-full' })}>Minta tautan baru</a>
		{:else}
			<div class="space-y-2 text-center">
				<h1 class="text-2xl font-bold tracking-tight">Buat kata sandi baru</h1>
				<p class="text-sm text-muted-foreground">
					Setelah kata sandi diganti, akun Anda akan dikeluarkan dari semua perangkat.
				</p>
			</div>

			{#if form?.message}
				<div
					role="alert"
					class="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
				>
					{form.message}
				</div>
			{/if}

			<form method="post" use:enhance={submit} class="space-y-4" novalidate>
				<input type="hidden" name="token" value={data.token} />
				<div class="space-y-2">
					<Label for="password">Kata sandi baru</Label>
					<Input
						id="password"
						name="password"
						type="password"
						placeholder={t('auth.passwordPlaceholder')}
						error={!!passwordError}
						disabled={loading}
						autocomplete="new-password"
						minlength={PASSWORD_MIN_LENGTH}
						aria-invalid={passwordError ? 'true' : undefined}
						aria-describedby="password-hint"
						required
					/>
					{#if passwordError}
						<p class="text-sm text-destructive">{passwordError}</p>
					{/if}
					<p id="password-hint" class="text-xs text-muted-foreground">
						Minimal {PASSWORD_MIN_LENGTH} karakter, dengan huruf besar, huruf kecil, dan angka.
					</p>
				</div>

				<div class="space-y-2">
					<Label for="confirmPassword">{t('auth.confirmPassword')}</Label>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						placeholder="Masukkan ulang kata sandi baru"
						error={!!confirmError}
						disabled={loading}
						autocomplete="new-password"
						aria-invalid={confirmError ? 'true' : undefined}
						required
					/>
					{#if confirmError}
						<p class="text-sm text-destructive">{confirmError}</p>
					{/if}
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? t('common.loading') : 'Simpan kata sandi baru'}
				</Button>
			</form>
		{/if}

		<p class="text-center text-sm text-muted-foreground">
			<a
				href="/masuk"
				class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
			>
				<ArrowLeft class="h-4 w-4" />
				Kembali ke halaman masuk
			</a>
		</p>
	</div>
</main>

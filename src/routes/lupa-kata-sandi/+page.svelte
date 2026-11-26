<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ArrowLeft, KeyRound, MailCheck } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);

	const submit = () => {
		loading = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			loading = false;
			await update();
		};
	};
</script>

<svelte:head>
	<title>Lupa Kata Sandi - Buku UMKM</title>
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
				<KeyRound class="h-6 w-6 text-primary-foreground" />
			</div>
		</div>

		<!-- Header -->
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-bold tracking-tight">Lupa kata sandi?</h1>
			<p class="text-sm text-muted-foreground">
				Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.
			</p>
		</div>

		<!-- Error Message -->
		{#if form?.message}
			<div
				role="alert"
				class="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
			>
				{form.message}
			</div>
		{/if}

		{#if form?.sent}
			<!-- The same answer whether or not the address has an account. -->
			<div
				role="status"
				class="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
			>
				<p class="flex items-center gap-2 font-medium">
					<MailCheck class="h-4 w-4 shrink-0" />
					Periksa email Anda
				</p>
				<p>
					Jika <strong class="break-all">{form.email}</strong> terdaftar di Buku UMKM, kami telah
					mengirim tautan untuk mengatur ulang kata sandi. Tautan berlaku selama {data.linkLifetimeHours}
					jam.
				</p>
				<p>Belum menerima email? Periksa folder spam, atau kirim ulang tautan.</p>
			</div>

			<form method="post" use:enhance={submit} class="space-y-3">
				<input type="hidden" name="email" value={form.email} />
				<Button type="submit" variant="outline" class="w-full" disabled={loading}>
					{loading ? t('common.loading') : 'Kirim ulang tautan'}
				</Button>
			</form>
		{:else}
			<form method="post" use:enhance={submit} class="space-y-4">
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
						aria-invalid={form?.errors?.email ? 'true' : undefined}
						aria-describedby={form?.errors?.email ? 'email-error' : undefined}
						required
					/>
					{#if form?.errors?.email}
						<p id="email-error" class="text-sm text-destructive">{form.errors.email}</p>
					{/if}
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? t('common.loading') : 'Kirim tautan atur ulang'}
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

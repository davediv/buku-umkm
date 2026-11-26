<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button';
	import { BadgeCheck, Link2Off, MailWarning } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const RESEND_HREF = '/pengaturan?bagian=akun';

	const content = $derived(
		{
			verified: {
				title: 'Email berhasil diverifikasi',
				body: 'Terima kasih. Alamat email Anda sudah terverifikasi, sehingga tautan atur ulang kata sandi dapat sampai kepada Anda.',
				actionLabel: 'Buka Buku UMKM',
				actionHref: '/beranda'
			},
			expired: {
				title: 'Tautan sudah kedaluwarsa',
				body: 'Tautan verifikasi ini sudah tidak berlaku. Masuk ke Buku UMKM, lalu kirim ulang email verifikasi dari Pengaturan > Akun Saya.',
				actionLabel: 'Kirim ulang email verifikasi',
				actionHref: RESEND_HREF
			},
			invalid: {
				title: 'Tautan tidak valid',
				body: 'Tautan verifikasi ini tidak dikenali atau tidak lengkap. Salin seluruh tautan dari email, atau kirim ulang email verifikasi dari Pengaturan > Akun Saya.',
				actionLabel: 'Kirim ulang email verifikasi',
				actionHref: RESEND_HREF
			},
			missing: {
				title: 'Verifikasi email',
				body: 'Buka tautan dari email verifikasi yang kami kirim. Jika belum menerimanya, kirim ulang dari Pengaturan > Akun Saya.',
				actionLabel: 'Buka Pengaturan',
				actionHref: RESEND_HREF
			}
		}[data.result]
	);
</script>

<svelte:head>
	<title>Verifikasi Email - Buku UMKM</title>
	<meta name="robots" content="noindex" />
	<!-- The URL carries the verification token; never pass it on in a Referer. -->
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
		<div class="flex justify-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20"
			>
				{#if data.result === 'verified'}
					<BadgeCheck class="h-6 w-6 text-primary-foreground" />
				{:else if data.result === 'missing'}
					<MailWarning class="h-6 w-6 text-primary-foreground" />
				{:else}
					<Link2Off class="h-6 w-6 text-primary-foreground" />
				{/if}
			</div>
		</div>

		<div class="space-y-2 text-center" role={data.result === 'verified' ? 'status' : undefined}>
			<h1 class="text-2xl font-bold tracking-tight">{content.title}</h1>
			<p class="text-sm text-muted-foreground">{content.body}</p>
		</div>

		<a href={content.actionHref} class={buttonVariants({ class: 'w-full' })}>
			{content.actionLabel}
		</a>
	</div>
</main>

<script lang="ts">
	import { buttonVariants } from '#lib/components/ui/button/index.ts';
	import { CircleCheck } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Akun Dihapus - Buku UMKM</title>
	<meta name="robots" content="noindex" />
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
				<CircleCheck class="h-6 w-6 text-primary-foreground" />
			</div>
		</div>

		<div class="space-y-3 text-center" role="status">
			<h1 class="text-2xl font-bold tracking-tight">Akun Anda sudah dihapus</h1>
			<p class="text-sm text-muted-foreground">
				Akun, semua buku, dan semua foto nota Anda telah dihapus permanen dari Buku UMKM, dan Anda
				sudah keluar dari semua perangkat.
			</p>
			<p class="text-sm text-muted-foreground">
				File cadangan atau laporan yang pernah Anda unduh tetap ada di perangkat Anda sampai Anda
				menghapusnya sendiri.
			</p>
		</div>

		<div class="space-y-3">
			<a href="/" class={buttonVariants({ class: 'w-full' })}>Kembali ke beranda</a>
			<p class="text-center text-sm text-muted-foreground">
				Ingin mulai lagi?
				<a href="/daftar" class="font-medium text-primary hover:underline">Buat akun baru</a>
			</p>
		</div>
	</div>
</main>

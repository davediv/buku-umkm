<script lang="ts">
	import {
		AlertTriangle,
		ArrowLeft,
		BookOpenCheck,
		Calculator,
		FileBarChart
	} from '@lucide/svelte';
	import { APP_VERSION } from '$lib/constants';
</script>

<svelte:head>
	<title>Tentang - Buku UMKM</title>
	<meta name="description" content="Tentang tujuan dan cakupan Buku UMKM." />
</svelte:head>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
		<a
			href="/lainnya"
			class="-ml-2 rounded-full p-2 transition-colors hover:bg-secondary"
			aria-label="Kembali ke Menu"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-lg font-semibold">Tentang Buku UMKM</h1>
			<p class="text-xs text-muted-foreground">Versi {APP_VERSION}</p>
		</div>
	</header>

	<div class="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
		<section class="flex items-start gap-4 rounded-xl border bg-card p-5">
			<div
				class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
			>
				<span class="text-2xl font-bold">B</span>
			</div>
			<div class="space-y-2">
				<h2 class="text-xl font-semibold">Pembukuan yang lebih mudah dipahami</h2>
				<p class="text-sm leading-6 text-muted-foreground">
					Buku UMKM membantu pelaku usaha Indonesia mencatat aktivitas keuangan, memahami posisi
					usaha, dan menyiapkan informasi untuk pelaporan.
				</p>
			</div>
		</section>

		<div class="grid gap-4 md:grid-cols-3">
			<section class="space-y-3 rounded-xl border bg-card p-5">
				<BookOpenCheck class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Catat</h2>
				<p class="text-sm leading-6 text-muted-foreground">
					Pemasukan, pengeluaran, rekening, kategori, utang, dan piutang.
				</p>
			</section>
			<section class="space-y-3 rounded-xl border bg-card p-5">
				<FileBarChart class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Pahami</h2>
				<p class="text-sm leading-6 text-muted-foreground">
					Ringkasan dan laporan berdasarkan catatan yang telah tersimpan.
				</p>
			</section>
			<section class="space-y-3 rounded-xl border bg-card p-5">
				<Calculator class="h-5 w-5 text-primary" />
				<h2 class="font-semibold">Siapkan</h2>
				<p class="text-sm leading-6 text-muted-foreground">
					Estimasi pajak berbasis profil untuk membantu persiapan pelaporan resmi.
				</p>
			</section>
		</div>

		<section
			class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
		>
			<div class="flex items-start gap-3">
				<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
				<div class="space-y-1">
					<h2 class="font-semibold">Batasan informasi pajak</h2>
					<p class="text-sm leading-6">
						Perhitungan di Buku UMKM adalah estimasi, bukan ketetapan, kode billing, atau bukti
						pelaporan resmi. Cocokkan hasil dengan ketentuan dan layanan DJP yang berlaku atau
						mintalah bantuan profesional bila situasi usaha Anda kompleks.
					</p>
				</div>
			</div>
		</section>
	</div>
</div>

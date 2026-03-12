<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, BookOpen, Calculator, Shield, Smartphone, TrendingUp } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Buku UMKM - Aplikasi Keuangan Gratis untuk Bisnis Anda</title>
	<meta
		name="description"
		content="Kelola keuangan bisnis Anda dengan mudah. Aplikasi bookkeeping gratis untuk UMKM Indonesia dengan fitur pajak PPh Final 0.5%."
	/>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-background to-secondary/20">
	<!-- Header -->
	<header class="container mx-auto px-4 py-6">
		<nav class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<BookOpen class="w-8 h-8 text-primary" />
				<span class="text-xl font-bold">Buku UMKM</span>
			</div>
			<div class="flex items-center gap-4">
				<a href="/masuk">
					<Button variant="ghost">Masuk</Button>
				</a>
				<a href="/daftar">
					<Button>Daftar Gratis</Button>
				</a>
			</div>
		</nav>
	</header>

	<!-- Hero Section -->
	<section class="container mx-auto px-4 py-16 md:py-24">
		<div class="max-w-3xl mx-auto text-center space-y-6">
			<h1 class="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
				Kelola Keuangan Bisnis dengan Mudah
			</h1>
			<p class="text-lg md:text-xl text-muted-foreground">
				Aplikasi bookkeeping gratis untuk UMKM Indonesia. Catat transaksi, pantau arus kas, dan
				hitung pajak PPh Final 0.5% dengan praktis.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
				<a href="/daftar">
					<Button size="lg" class="w-full sm:w-auto gap-2">
						Mulai Gratis
						<ArrowRight class="w-4 h-4" />
					</Button>
				</a>
				<a href="/masuk">
					<Button size="lg" variant="outline" class="w-full sm:w-auto">Masuk</Button>
				</a>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="container mx-auto px-4 py-16 bg-card">
		<h2 class="text-2xl md:text-3xl font-bold text-center mb-12">Fitur Utama</h2>
		<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
			<!-- Feature 1 -->
			<div
				class="flex flex-col items-center text-center p-6 space-y-4 rounded-lg border bg-background"
			>
				<div class="p-3 rounded-full bg-primary/10">
					<TrendingUp class="w-8 h-8 text-primary" />
				</div>
				<h3 class="text-lg font-semibold">Catat Transaksi</h3>
				<p class="text-muted-foreground">
					Catat setiap transaksi dengan mudah. Pisahkan antara pemasukan dan pengeluaran secara
					otomatis.
				</p>
			</div>

			<!-- Feature 2 -->
			<div
				class="flex flex-col items-center text-center p-6 space-y-4 rounded-lg border bg-background"
			>
				<div class="p-3 rounded-full bg-primary/10">
					<Calculator class="w-8 h-8 text-primary" />
				</div>
				<h3 class="text-lg font-semibold">Pajak Otomatis</h3>
				<p class="text-muted-foreground">
					Hitung PPh Final 0.5% secara otomatis. Siapkan kode billing dengan mudah setiap bulan.
				</p>
			</div>

			<!-- Feature 3 -->
			<div
				class="flex flex-col items-center text-center p-6 space-y-4 rounded-lg border bg-background"
			>
				<div class="p-3 rounded-full bg-primary/10">
					<Shield class="w-8 h-8 text-primary" />
				</div>
				<h3 class="text-lg font-semibold">Laporan Keuangan</h3>
				<p class="text-muted-foreground">
					Buat laporan laba rugi dan posisi keuangan dengan sekali klik. Siap untuk pajak tahunan.
				</p>
			</div>

			<!-- Feature 4 -->
			<div
				class="flex flex-col items-center text-center p-6 space-y-4 rounded-lg border bg-background"
			>
				<div class="p-3 rounded-full bg-primary/10">
					<Smartphone class="w-8 h-8 text-primary" />
				</div>
				<h3 class="text-lg font-semibold">Offline-First</h3>
				<p class="text-muted-foreground">
					Bisa digunakan tanpa internet. Sinkronkan data saat terhubung kembali.
				</p>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="container mx-auto px-4 py-16">
		<div class="max-w-2xl mx-auto text-center space-y-6">
			<h2 class="text-2xl md:text-3xl font-bold">Siap Mengelola Keuangan Bisnis?</h2>
			<p class="text-muted-foreground">
				Bergabunglah dengan ribuan pelaku UMKM yang sudah menggunakan Buku UMKM untuk mengelola
				keuangan mereka.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center pt-4">
				<a href="/daftar">
					<Button size="lg" class="w-full sm:w-auto gap-2">
						Daftar Sekarang
						<ArrowRight class="w-4 h-4" />
					</Button>
				</a>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="container mx-auto px-4 py-8 border-t">
		<div class="flex flex-col md:flex-row items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<BookOpen class="w-6 h-6 text-muted-foreground" />
				<span class="font-medium">Buku UMKM</span>
			</div>
			<p class="text-sm text-muted-foreground">Gratis untuk digunakan. Open source.</p>
		</div>
	</footer>
</div>

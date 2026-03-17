<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowRight,
		BookOpen,
		Calculator,
		TrendingUp,
		Zap,
		BarChart3,
		Wifi
	} from '@lucide/svelte';
	import type { Component } from 'svelte';

	const features: Array<{ icon: Component; title: string; desc: string }> = [
		{
			icon: TrendingUp,
			title: 'Catat Transaksi',
			desc: 'Catat setiap pemasukan dan pengeluaran dengan cepat. Dilengkapi foto nota dan template.'
		},
		{
			icon: Calculator,
			title: 'Pajak Otomatis',
			desc: 'Hitung PPh Final 0.5% secara otomatis. Siapkan kode billing dengan mudah setiap bulan.'
		},
		{
			icon: BarChart3,
			title: 'Laporan Keuangan',
			desc: 'Buat laporan laba rugi, neraca, dan catatan keuangan sesuai standar SAK EMKM.'
		},
		{
			icon: Wifi,
			title: 'Offline-First',
			desc: 'Bisa digunakan tanpa internet. Data tersinkron otomatis saat terhubung kembali.'
		}
	];

	const trustIndicators = ['100% Gratis', 'Offline-First', 'Data Aman di Perangkat'];
</script>

<svelte:head>
	<title>Buku UMKM - Aplikasi Keuangan Gratis untuk Bisnis Anda</title>
	<meta
		name="description"
		content="Kelola keuangan bisnis Anda dengan mudah. Aplikasi bookkeeping gratis untuk UMKM Indonesia dengan fitur pajak PPh Final 0.5%."
	/>
</svelte:head>

<div class="min-h-screen overflow-hidden">
	<!-- Decorative background -->
	<div
		class="pointer-events-none fixed inset-0 -z-10"
		style="background: radial-gradient(ellipse 80% 60% at 50% -20%, hsl(16 70% 38% / 0.06), transparent), radial-gradient(ellipse 60% 40% at 80% 80%, hsl(38 85% 52% / 0.04), transparent);"
	></div>

	<!-- Header -->
	<header class="animate-fade-in">
		<div class="container mx-auto px-4 py-5 md:py-6">
			<nav class="flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm">
						<BookOpen class="h-5 w-5 text-primary-foreground" />
					</div>
					<span class="text-lg font-bold tracking-tight">Buku UMKM</span>
				</div>
				<div class="flex items-center gap-3">
					<a href="/masuk">
						<Button variant="ghost" size="sm">Masuk</Button>
					</a>
					<a href="/daftar">
						<Button size="sm">Daftar Gratis</Button>
					</a>
				</div>
			</nav>
		</div>
	</header>

	<!-- Hero Section -->
	<section class="container mx-auto px-4 pb-16 pt-12 md:pb-24 md:pt-20">
		<div class="mx-auto max-w-3xl">
			<div
				class="animate-fade-up inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary"
			>
				<Zap class="h-3 w-3" />
				Gratis & Open Source
			</div>

			<h1
				class="animate-fade-up animation-delay-100 mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl"
			>
				Keuangan bisnis Anda,
				<span class="text-[hsl(18,80%,42%)]">rapi & mudah.</span>
			</h1>

			<p
				class="animate-fade-up animation-delay-200 mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
			>
				Catat transaksi, hitung pajak PPh Final 0.5%, dan buat laporan keuangan sesuai SAK EMKM
				dalam satu aplikasi.
			</p>

			<div class="animate-fade-up animation-delay-300 mt-8 flex flex-col gap-3 sm:flex-row">
				<a href="/daftar">
					<Button size="lg" class="w-full gap-2 shadow-md sm:w-auto">
						Mulai Gratis
						<ArrowRight class="h-4 w-4" />
					</Button>
				</a>
				<a href="/masuk">
					<Button size="lg" variant="outline" class="w-full sm:w-auto">Masuk</Button>
				</a>
			</div>

			<!-- Trust indicators -->
			<div
				class="animate-fade-up animation-delay-400 mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
			>
				{#each trustIndicators as label (label)}
					<span class="flex items-center gap-1.5">
						<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
						{label}
					</span>
				{/each}
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="border-y bg-card/60">
		<div class="container mx-auto px-4 py-16 md:py-20">
			<div class="mx-auto max-w-lg text-center">
				<h2 class="text-2xl font-bold tracking-tight md:text-3xl">
					Semua yang bisnis Anda butuhkan
				</h2>
				<p class="mt-3 text-muted-foreground">Dirancang khusus untuk pelaku UMKM Indonesia</p>
			</div>

			<div class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{#each features as feature (feature.title)}
					<div
						class="group rounded-2xl bg-card p-7 shadow-sm ring-1 ring-border/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/[0.08] hover:ring-primary/20"
					>
						<div
							class="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/[0.12] to-primary/[0.04] transition-transform duration-300 group-hover:scale-105"
						>
							<feature.icon class="h-5 w-5 text-primary" />
						</div>
						<h3 class="font-semibold tracking-tight">{feature.title}</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted-foreground">
							{feature.desc}
						</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="relative">
		<div
			class="pointer-events-none absolute inset-0 -z-10"
			style="background: linear-gradient(to bottom, transparent, hsl(16 70% 38% / 0.03) 30%, hsl(16 70% 38% / 0.06) 70%, transparent);"
		></div>
		<div class="container mx-auto px-4 py-16 md:py-20">
			<div class="mx-auto max-w-lg text-center">
				<h2 class="text-2xl font-bold tracking-tight md:text-3xl">
					Siap mengelola keuangan bisnis?
				</h2>
				<p class="mt-3 text-muted-foreground">
					Bergabunglah dengan pelaku UMKM yang sudah menggunakan Buku UMKM untuk mengelola keuangan
					mereka.
				</p>
				<div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
					<a href="/daftar">
						<Button size="lg" class="w-full gap-2 shadow-md sm:w-auto">
							Daftar Sekarang
							<ArrowRight class="h-4 w-4" />
						</Button>
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t">
		<div class="container mx-auto px-4 py-8">
			<div class="flex flex-col items-center justify-between gap-4 md:flex-row">
				<div class="flex items-center gap-2.5">
					<div class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
						<BookOpen class="h-4 w-4 text-primary" />
					</div>
					<span class="font-semibold">Buku UMKM</span>
				</div>
				<p class="text-sm text-muted-foreground">Gratis untuk digunakan. Open source.</p>
			</div>
		</div>
	</footer>
</div>

<script lang="ts">
	import { ArrowLeft, ChevronRight, FileText } from '@lucide/svelte';
	import ReportNavigation from '$lib/components/reports/report-navigation.svelte';
	import { REPORT_DEFINITIONS } from '$lib/reports/navigation';
</script>

<svelte:head>
	<title>Laporan - Buku UMKM</title>
	<meta name="description" content="Pilih laporan keuangan dan draft pendukung pajak Buku UMKM." />
</svelte:head>

<div class="space-y-6 p-4 md:p-6">
	<header class="flex items-center gap-4">
		<a
			href="/beranda"
			class="rounded-lg p-2 transition-colors hover:bg-accent"
			aria-label="Kembali ke Beranda"
		>
			<ArrowLeft class="h-5 w-5" />
		</a>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Laporan</h1>
			<p class="text-sm text-muted-foreground">Pilih laporan yang ingin ditinjau</p>
		</div>
	</header>

	<ReportNavigation />

	<main>
		<ul class="grid gap-4 md:grid-cols-2">
			{#each REPORT_DEFINITIONS as report (report.id)}
				<li>
					<a
						href={report.href}
						class="group flex h-full min-h-36 items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/30"
					>
						<span
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<FileText class="h-5 w-5" />
						</span>
						<span class="min-w-0 flex-1 space-y-2">
							<span class="block font-semibold">{report.label}</span>
							<span class="block text-sm leading-6 text-muted-foreground">
								{report.description}
							</span>
							<span class="block text-xs font-medium text-muted-foreground">
								Ekspor: {report.exports.map((format) => format.toUpperCase()).join(' + ')}
							</span>
						</span>
						<ChevronRight
							class="mt-2 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
						/>
					</a>
				</li>
			{/each}
		</ul>
	</main>
</div>

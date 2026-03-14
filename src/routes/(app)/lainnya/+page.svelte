<script lang="ts">
	import { Settings, HelpCircle, Info, Shield, Database, ArrowRight } from '@lucide/svelte';
	import { APP_VERSION } from '$lib/constants';

	type MenuItem = {
		title: string;
		desc: string;
		icon: typeof Settings;
		href: string;
	};

	const sections: { label: string; items: MenuItem[] }[] = [
		{
			label: 'Pengaturan',
			items: [
				{
					title: 'Pengaturan Bisnis',
					desc: 'Ubah profil dan informasi bisnis',
					icon: Settings,
					href: '/onboarding'
				},
				{
					title: 'Bantuan',
					desc: 'Panduan dan FAQ',
					icon: HelpCircle,
					href: '#'
				},
				{
					title: 'Tentang',
					desc: 'Versi dan lisensi aplikasi',
					icon: Info,
					href: '#'
				},
				{
					title: 'Kebijakan Privasi',
					desc: 'Baca kebijakan privasi kami',
					icon: Shield,
					href: '#'
				}
			]
		},
		{
			label: 'Data',
			items: [
				{
					title: 'Cadangkan & Pulihkan Data',
					desc: 'Backup dan restore data bisnis',
					icon: Database,
					href: '/pengaturan'
				}
			]
		}
	];
</script>

<svelte:head>
	<title>Lainnya - Buku UMKM</title>
</svelte:head>

<div class="p-4 md:p-6 space-y-6">
	<h1 class="text-2xl font-bold">Lainnya</h1>

	{#each sections as section (section.label)}
		<section class="space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">
				{section.label}
			</h2>
			<div class="space-y-2">
				{#each section.items as item (item.title)}
					<a
						href={item.href}
						class="flex items-center gap-4 p-4 rounded-lg bg-card border hover:bg-secondary/50 transition-colors"
					>
						<div class="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
							<item.icon class="w-5 h-5" />
						</div>
						<div class="flex-1">
							<p class="font-medium">{item.title}</p>
							<p class="text-sm text-muted-foreground">{item.desc}</p>
						</div>
						<ArrowRight class="w-5 h-5 text-muted-foreground" />
					</a>
				{/each}
			</div>
		</section>
	{/each}

	<!-- App Info -->
	<section class="pt-6 text-center text-sm text-muted-foreground">
		<p>Buku UMKM v{APP_VERSION}</p>
		<p class="mt-1">Gratis dan open source</p>
	</section>
</div>

<script lang="ts">
	import { page } from '$app/stores';
	import { Home, Receipt, CreditCard, Calculator, Menu, Wallet, Plus } from '@lucide/svelte';

	let { children } = $props();

	const navItems: Array<{ href: string; label: string; icon: typeof Home }> = [
		{ href: '/beranda', label: 'Beranda', icon: Home },
		{ href: '/akun', label: 'Akun', icon: Wallet },
		{ href: '/transaksi', label: 'Transaksi', icon: Receipt },
		{ href: '/hutang-piutang', label: 'Hutang/Piutang', icon: CreditCard },
		{ href: '/pajak', label: 'Pajak', icon: Calculator },
		{ href: '/lainnya', label: 'Lainnya', icon: Menu }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/beranda') {
			return pathname === '/beranda' || pathname === '/';
		}
		return pathname.startsWith(href);
	}

	// Check if current page is a transaction form (hide FAB there)
	let hideFab = $derived(
		$page.url.pathname === '/transaksi/tambah' ||
			$page.url.pathname.match(/^\/transaksi\/[\w-]+$/) !== null
	);
</script>

<div class="flex flex-col min-h-screen bg-background">
	<!-- Main Content Area -->
	<main class="flex-1 overflow-y-auto pb-20 md:pb-0 md:pl-20">
		{@render children()}
	</main>

	<!-- Floating Action Button (FAB) for adding transaction -->
	{#if !hideFab}
		<a
			href="/transaksi/tambah"
			class="fixed right-4 bottom-20 md:bottom-4 md:right-4 z-40 flex items-center justify-center w-14 h-14 md:w-12 md:h-12 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
			aria-label="Tambah transaksi baru"
		>
			<Plus class="w-6 h-6" />
		</a>
	{/if}

	<!-- Bottom Navigation Bar - Mobile -->
	<nav
		class="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-50"
		aria-label="Navigasi utama"
	>
		<ul class="flex justify-around items-center h-16">
			{#each navItems as item (item.href)}
				{@const active = isActive(item.href, $page.url.pathname)}
				<li class="flex-1">
					<a
						href={item.href}
						class="flex flex-col items-center justify-center h-full min-h-[48px] min-w-[48px] gap-1 transition-colors {active
							? 'text-primary'
							: 'text-muted-foreground hover:text-foreground'}"
						aria-current={active ? 'page' : undefined}
					>
						<item.icon class="w-5 h-5" />
						<span class="text-xs font-medium">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Sidebar Navigation - Desktop -->
	<aside
		class="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col bg-card border-r border-border z-50"
	>
		<ul class="flex flex-col items-center py-4 gap-2">
			{#each navItems as item (item.href)}
				{@const active = isActive(item.href, $page.url.pathname)}
				<li>
					<a
						href={item.href}
						class="flex flex-col items-center justify-center w-16 h-16 gap-1 rounded-lg transition-colors {active
							? 'bg-primary/10 text-primary'
							: 'text-muted-foreground hover:text-foreground hover:bg-secondary'}"
						aria-current={active ? 'page' : undefined}
					>
						<item.icon class="w-6 h-6" />
						<span class="text-xs font-medium">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</aside>
</div>

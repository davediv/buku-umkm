<script lang="ts">
	import { page } from '$app/state';
	import {
		Home,
		Receipt,
		FileText,
		CreditCard,
		Calculator,
		Menu,
		Wallet,
		Plus
	} from '@lucide/svelte';
	import TaxReminder from '$lib/components/tax-reminder.svelte';
	import SyncStatusIndicator from '$lib/components/sync-status-indicator.svelte';
	import Toast from '$lib/components/ui/toast/toast.svelte';

	let { children } = $props();

	const navItems: Array<{ href: string; label: string; icon: typeof Home }> = [
		{ href: '/beranda', label: 'Beranda', icon: Home },
		{ href: '/akun', label: 'Akun', icon: Wallet },
		{ href: '/transaksi', label: 'Transaksi', icon: Receipt },
		{ href: '/laporan', label: 'Laporan', icon: FileText },
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
		page.url.pathname === '/transaksi/tambah' ||
			page.url.pathname.match(/^\/transaksi\/[\w-]+$/) !== null
	);
</script>

<div class="flex min-h-screen flex-col bg-background">
	<!-- Tax Reminder Banner -->
	<TaxReminder />

	<!-- Sync Status - Mobile only (desktop is in sidebar) -->
	<div class="md:hidden">
		<SyncStatusIndicator />
	</div>

	<!-- Main Content Area -->
	<main class="flex-1 overflow-y-auto pb-20 md:pb-0 md:pl-20">
		{@render children()}
	</main>

	<!-- Floating Action Button (FAB) for adding transaction -->
	{#if !hideFab}
		<a
			href="/transaksi/tambah"
			class="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-[transform,background-color,box-shadow] hover:scale-105 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-95 md:bottom-4 md:right-4 md:h-12 md:w-12"
			aria-label="Tambah transaksi baru"
		>
			<Plus class="h-6 w-6" />
		</a>
	{/if}

	<!-- Bottom Navigation Bar - Mobile -->
	<nav
		class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden"
		aria-label="Navigasi utama"
	>
		<ul class="flex h-16 items-center justify-around">
			{#each navItems as item (item.href)}
				{@const active = isActive(item.href, page.url.pathname)}
				<li class="flex-1">
					<a
						href={item.href}
						class="flex h-full min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 transition-colors {active
							? 'text-primary'
							: 'text-muted-foreground hover:text-foreground'}"
						aria-current={active ? 'page' : undefined}
					>
						<div
							class="flex h-7 w-7 items-center justify-center rounded-md transition-colors {active
								? 'bg-primary/10'
								: ''}"
						>
							<item.icon class="h-[18px] w-[18px]" />
						</div>
						<span class="text-[10px] font-medium">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Sidebar Navigation - Desktop -->
	<aside
		class="fixed bottom-0 left-0 top-0 z-50 hidden w-20 flex-col border-r border-border bg-card md:flex"
	>
		<!-- Logo area -->
		<div class="flex h-16 items-center justify-center border-b border-border">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
			>
				B
			</div>
		</div>

		<ul class="flex flex-1 flex-col items-center gap-1 py-3">
			{#each navItems as item (item.href)}
				{@const active = isActive(item.href, page.url.pathname)}
				<li>
					<a
						href={item.href}
						class="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors {active
							? 'bg-primary/10 text-primary'
							: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
						aria-current={active ? 'page' : undefined}
					>
						<item.icon class="h-5 w-5" />
						<span class="text-[10px] font-medium leading-tight">{item.label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<!-- Sync status at bottom of sidebar -->
		<div class="flex justify-center border-t border-border py-3">
			<SyncStatusIndicator />
		</div>
	</aside>

	<!-- Toast Notifications -->
	<Toast />
</div>

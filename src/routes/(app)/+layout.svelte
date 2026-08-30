<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { BookOpen } from '@lucide/svelte';
	import TaxReminder from '$lib/components/tax-reminder.svelte';
	import ConnectionStatus from '$lib/components/connection-status.svelte';
	import Toast from '$lib/components/ui/toast/toast.svelte';
	import {
		desktopCreateAction,
		desktopNavigationGroups,
		isNavigationItemActive,
		mobileNavigation
	} from '$lib/navigation';
	import { rememberNavigationOrigin } from '$lib/client/navigation-continuity';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
	let desktopCreateActive = $derived(
		isNavigationItemActive(desktopCreateAction, page.url.pathname)
	);

	beforeNavigate((navigation) => {
		if (
			navigation.type === 'popstate' ||
			!navigation.from?.url ||
			!navigation.to?.url ||
			navigation.from.url.origin !== navigation.to.url.origin
		) {
			return;
		}

		rememberNavigationOrigin(
			`${navigation.to.url.pathname}${navigation.to.url.search}`,
			`${navigation.from.url.pathname}${navigation.from.url.search}`
		);
	});
</script>

<div class="flex min-h-screen flex-col bg-background">
	<ConnectionStatus loadedAt={data.loadedAt} />
	<TaxReminder />

	<main id="main-content" class="flex-1 overflow-y-auto pb-20 md:pb-0 md:pl-64">
		{@render children()}
	</main>

	<nav
		class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card md:hidden"
		aria-label="Navigasi utama"
	>
		<ul class="grid h-16 grid-cols-5 items-stretch">
			{#each mobileNavigation as item (item.href)}
				{@const active = isNavigationItemActive(item, page.url.pathname)}
				<li class="min-w-0">
					{#if item.primaryAction}
						<a
							href={item.href}
							class="relative flex h-full min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 text-primary"
							aria-current={active ? 'page' : undefined}
						>
							<span
								class="-mt-6 flex h-12 w-12 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
							>
								<item.icon class="h-6 w-6" />
							</span>
							<span class="text-[10px] font-semibold leading-none">{item.label}</span>
						</a>
					{:else}
						<a
							href={item.href}
							class="flex h-full min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 px-1 transition-colors {active
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'}"
							aria-current={active ? 'page' : undefined}
						>
							<span
								class="flex h-7 w-7 items-center justify-center rounded-md {active
									? 'bg-primary/10'
									: ''}"
							>
								<item.icon class="h-[18px] w-[18px]" />
							</span>
							<span class="max-w-full truncate text-[10px] font-medium">{item.label}</span>
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<aside
		class="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-card md:flex"
		aria-label="Navigasi aplikasi"
	>
		<a href="/beranda" class="flex h-16 items-center gap-3 border-b border-border px-5">
			<span
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
			>
				<BookOpen class="h-5 w-5" />
			</span>
			<span class="font-bold tracking-tight">Buku UMKM</span>
		</a>

		<div class="border-b border-border p-4">
			<a
				href={desktopCreateAction.href}
				class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 {desktopCreateActive
					? 'ring-2 ring-primary ring-offset-2'
					: ''}"
				aria-current={desktopCreateActive ? 'page' : undefined}
			>
				<desktopCreateAction.icon class="h-5 w-5" />
				{desktopCreateAction.label}
			</a>
		</div>

		<nav class="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Menu utama desktop">
			{#each desktopNavigationGroups as group (group.label)}
				<section aria-labelledby="nav-group-{group.label.toLowerCase()}">
					<h2
						id="nav-group-{group.label.toLowerCase()}"
						class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
					>
						{group.label}
					</h2>
					<ul class="space-y-1">
						{#each group.items as item (item.href)}
							{@const active = isNavigationItemActive(item, page.url.pathname)}
							<li>
								<a
									href={item.href}
									class="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {active
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
									aria-current={active ? 'page' : undefined}
								>
									<item.icon class="h-5 w-5 shrink-0" />
									<span>{item.label}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</nav>
	</aside>

	<Toast />
</div>

<script lang="ts">
	import { page } from '$app/state';
	import { REPORT_DEFINITIONS } from '$lib/reports/navigation';
</script>

<nav aria-label="Jenis laporan" class="print:hidden">
	<ul class="flex gap-2 overflow-x-auto pb-2">
		{#each REPORT_DEFINITIONS as report (report.id)}
			{@const active = page.url.pathname === report.href}
			<li>
				<a
					href={report.href}
					class="flex min-h-11 items-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors {active
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'}"
					aria-current={active ? 'page' : undefined}
				>
					{report.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>

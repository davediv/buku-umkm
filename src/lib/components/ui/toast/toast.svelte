<script lang="ts">
	import { toast, type ToastVariant } from './index';
	import { fly } from 'svelte/transition';

	const variantStyles: Record<ToastVariant, string> = {
		default: 'bg-background border',
		success: 'bg-green-50 border-green-200 text-green-800',
		error: 'bg-red-50 border-red-200 text-red-800',
		warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
	};
</script>

<div class="fixed bottom-4 right-4 z-50 space-y-2">
	{#each $toast as t (t.id)}
		<div
			class="px-4 py-3 rounded-lg shadow-lg border {variantStyles[
				t.variant
			]} min-w-[280px] max-w-sm"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<p class="font-medium text-sm">{t.title}</p>
			{#if t.description}
				<p class="text-xs opacity-80 mt-1">{t.description}</p>
			{/if}
		</div>
	{/each}
</div>

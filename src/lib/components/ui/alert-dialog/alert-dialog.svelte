<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Props = HTMLAttributes<HTMLDivElement> & {
		open?: boolean;
		onopenchange?: (open: boolean) => void;
		children: Snippet;
	};

	let { class: className, children, open, onopenchange }: Props = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onopenchange?.(false);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onopenchange?.(false);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="alert-dialog-title"
		aria-describedby="alert-dialog-description"
		onclick={handleBackdropClick}
	>
		<div class={cn('bg-background border rounded-lg shadow-lg w-full max-w-md p-6', className)}>
			{@render children()}
		</div>
	</div>
{/if}

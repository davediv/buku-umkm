<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
	};

	let { class: className, children, ...rest }: Props = $props();
</script>

<button
	class={cn(
		'inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium rounded-md transition-colors border border-input bg-background hover:bg-secondary',
		className
	)}
	{...rest}
>
	{@render children()}
</button>

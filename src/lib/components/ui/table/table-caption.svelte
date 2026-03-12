<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	type Props = {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	};

	let { class: className, children, ...rest }: Props = $props();
</script>

<caption class={cn('mt-4 text-sm text-muted-foreground', className)} {...rest}>
	{@render children?.()}
</caption>

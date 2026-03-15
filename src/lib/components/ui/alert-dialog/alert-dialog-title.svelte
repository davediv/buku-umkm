<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Props = HTMLAttributes<HTMLHeadingElement> & {
		children: Snippet;
	};

	let { class: className, children, ...rest }: Props = $props();
</script>

<h2 id="alert-dialog-title" class={cn('text-lg font-semibold', className)} {...rest}>
	{@render children()}
</h2>

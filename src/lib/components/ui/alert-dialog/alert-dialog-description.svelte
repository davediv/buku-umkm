<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Props = HTMLAttributes<HTMLParagraphElement> & {
		children: Snippet;
	};

	let { class: className, children, ...rest }: Props = $props();
</script>

<p id="alert-dialog-description" class={cn('text-sm text-muted-foreground', className)} {...rest}>
	{@render children()}
</p>

<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { Loader2 } from '@lucide/svelte';

	type Variant = 'default' | 'destructive' | 'warning';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
		loading?: boolean;
		variant?: Variant;
	};

	const variants: Record<Variant, string> = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		warning: 'bg-amber-500 text-white hover:bg-amber-600'
	};

	let {
		class: className,
		children,
		loading = false,
		variant = 'destructive',
		disabled,
		...rest
	}: Props = $props();
</script>

<button
	class={cn(
		'inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium rounded-md transition-colors disabled:opacity-50',
		variants[variant],
		className
	)}
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<Loader2 class="w-4 h-4 animate-spin" />
	{/if}
	{@render children()}
</button>

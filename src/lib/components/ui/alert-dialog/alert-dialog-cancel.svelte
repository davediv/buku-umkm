<script lang="ts">
	import { cn } from '$lib/utils';
	import { getContext } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { ALERT_DIALOG_CONTEXT, type AlertDialogContext } from './context';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
	};

	let { class: className, children, onclick, ...rest }: Props = $props();
	const dialog = getContext<AlertDialogContext>(ALERT_DIALOG_CONTEXT);

	function handleClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		onclick?.(event);
		if (!event.defaultPrevented) dialog?.close();
	}
</script>

<button
	data-dialog-initial-focus
	onclick={handleClick}
	class={cn(
		'inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium rounded-md transition-colors border border-input bg-background hover:bg-secondary',
		className
	)}
	{...rest}
>
	{@render children()}
</button>

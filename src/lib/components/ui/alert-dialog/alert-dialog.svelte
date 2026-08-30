<script lang="ts">
	import { Dialog } from '$lib/components/ui/dialog';
	import { setContext } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { ALERT_DIALOG_CONTEXT, type AlertDialogContext } from './context';

	type Props = HTMLAttributes<HTMLDivElement> & {
		open?: boolean;
		onopenchange?: (open: boolean) => void;
		closeOnExternalClick?: boolean;
		children: Snippet;
	};

	let {
		class: className,
		children,
		open,
		onopenchange,
		closeOnExternalClick = true
	}: Props = $props();

	setContext<AlertDialogContext>(ALERT_DIALOG_CONTEXT, {
		close: () => onopenchange?.(false)
	});
</script>

<Dialog
	{open}
	{onopenchange}
	closeOnEscape={closeOnExternalClick}
	closeOnOutsideClick={closeOnExternalClick}
	role="alertdialog"
	labelledby="alert-dialog-title"
	describedby="alert-dialog-description"
	class={className}
>
	{@render children()}
</Dialog>

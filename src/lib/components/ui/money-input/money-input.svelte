<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { formatRupiahInput, parseRupiahInput } from '#lib/client/money.ts';
	import { cn } from '#lib/utils/index.ts';

	type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'name'> & {
		/** Whole Rupiah, or null while the field is empty. */
		value?: number | null;
		/** Submits the plain digits under this name, for form actions. */
		name?: string;
		error?: boolean;
	};

	let { value = $bindable(null), name, error = false, class: className, ...rest }: Props = $props();

	let text = $state(formatRupiahInput(value));

	// Follow changes made outside the field, such as a form reset or quick-amount button.
	$effect(() => {
		if (parseRupiahInput(text) !== value) text = formatRupiahInput(value);
	});

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = parseRupiahInput(event.currentTarget.value);
		text = formatRupiahInput(value);
		event.currentTarget.value = text;
	}
</script>

<!-- A text field, not type="number": browsers read "50.000" in a number field as 50. -->
<input
	type="text"
	inputmode="numeric"
	autocomplete="off"
	value={text}
	oninput={handleInput}
	class={cn(
		'flex h-11 md:h-10 w-full rounded-md border border-input bg-background px-4 py-2 md:px-3 md:py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
		error && 'border-destructive focus-visible:ring-destructive',
		className
	)}
	{...rest}
/>
{#if name}
	<input type="hidden" {name} value={value ?? ''} />
{/if}

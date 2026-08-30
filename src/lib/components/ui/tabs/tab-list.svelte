<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {
		label: string;
		class?: HTMLAttributes<HTMLDivElement>['class'];
		children: Snippet;
	};

	let { label, class: className, children }: Props = $props();
	let listElement = $state<HTMLDivElement>();

	function handleKeydown(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

		const currentTab =
			event.target instanceof Element ? event.target.closest<HTMLElement>('[role="tab"]') : null;
		const tabs = Array.from(listElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
		const currentIndex = currentTab ? tabs.indexOf(currentTab) : -1;
		if (currentIndex < 0 || tabs.length === 0) return;

		event.preventDefault();
		let nextIndex = currentIndex;
		if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
		if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
		if (event.key === 'Home') nextIndex = 0;
		if (event.key === 'End') nextIndex = tabs.length - 1;
		tabs[nextIndex].focus();
	}
</script>

<div
	bind:this={listElement}
	role="tablist"
	tabindex="-1"
	aria-label={label}
	aria-orientation="horizontal"
	class={cn(className)}
	onkeydown={handleKeydown}
>
	{@render children()}
</div>

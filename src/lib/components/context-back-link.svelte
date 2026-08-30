<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import {
		getRememberedNavigationOrigin,
		shouldUseHistoryBack
	} from '$lib/client/navigation-continuity';

	type Props = {
		href: string;
		label: string;
		compact?: boolean;
		class?: string;
	};

	let { href, label, compact = false, class: className = '' }: Props = $props();

	function handleClick(event: MouseEvent) {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		const currentUrl = `${window.location.pathname}${window.location.search}`;
		const previousUrl = getRememberedNavigationOrigin(currentUrl) ?? document.referrer;
		if (
			window.history.length > 1 &&
			shouldUseHistoryBack(href, previousUrl, window.location.origin)
		) {
			event.preventDefault();
			window.history.back();
		}
	}
</script>

<a
	{href}
	onclick={handleClick}
	class="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground {className}"
>
	<ArrowLeft class="h-4 w-4" aria-hidden="true" />
	<span class:sr-only={compact}>{label}</span>
</a>

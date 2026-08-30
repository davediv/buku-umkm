<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		open?: boolean;
		onopenchange?: (open: boolean) => void;
		closeOnEscape?: boolean;
		closeOnOutsideClick?: boolean;
		role?: 'dialog' | 'alertdialog';
		ariaLabel?: string;
		labelledby?: string;
		describedby?: string;
		class?: HTMLAttributes<HTMLDivElement>['class'];
		overlayClass?: HTMLAttributes<HTMLDivElement>['class'];
		children: Snippet;
	};

	let {
		open = false,
		onopenchange,
		closeOnEscape = true,
		closeOnOutsideClick = true,
		role = 'dialog',
		ariaLabel,
		labelledby,
		describedby,
		class: className,
		overlayClass,
		children
	}: Props = $props();

	let contentElement = $state<HTMLDivElement>();
	const focusableSelector = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[contenteditable="true"]',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	function close() {
		onopenchange?.(false);
	}

	function getFocusableElements() {
		return Array.from(
			contentElement?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
		).filter((element) => {
			const style = getComputedStyle(element);
			return (
				!element.hasAttribute('hidden') &&
				element.getAttribute('aria-hidden') !== 'true' &&
				style.display !== 'none' &&
				style.visibility !== 'hidden'
			);
		});
	}

	function handleBackdropClick(event: MouseEvent) {
		if (closeOnOutsideClick && event.target === event.currentTarget) close();
	}

	function handleDocumentKeydown(event: KeyboardEvent) {
		const content = contentElement;
		if (!content) return;

		if (event.key === 'Escape' && closeOnEscape) {
			event.preventDefault();
			close();
			return;
		}

		if (event.key !== 'Tab') return;

		const focusableElements = getFocusableElements();
		if (focusableElements.length === 0) {
			event.preventDefault();
			content.focus();
			return;
		}

		const firstElement = focusableElements[0];
		const lastElement = focusableElements.at(-1)!;
		const activeElement = document.activeElement;

		if (event.shiftKey && (activeElement === firstElement || !content.contains(activeElement))) {
			event.preventDefault();
			lastElement.focus();
		} else if (!event.shiftKey && activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	}

	$effect(() => {
		if (!open) return;

		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleDocumentKeydown);

		queueMicrotask(() => {
			if (!open || !contentElement) return;
			const focusableElements = getFocusableElements();
			const initialFocus = focusableElements.find((element) =>
				element.hasAttribute('data-dialog-initial-focus')
			);
			(initialFocus ?? focusableElements[0] ?? contentElement).focus();
		});

		return () => {
			document.removeEventListener('keydown', handleDocumentKeydown);
			document.body.style.overflow = previousOverflow;
			if (previouslyFocused?.isConnected) queueMicrotask(() => previouslyFocused.focus());
		};
	});
</script>

{#if open}
	<div
		class={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4', overlayClass)}
		role="presentation"
		onclick={handleBackdropClick}
	>
		<div
			bind:this={contentElement}
			class={cn('w-full max-w-md rounded-lg border bg-card p-6 shadow-xl', className)}
			{role}
			aria-modal="true"
			aria-label={ariaLabel}
			aria-labelledby={labelledby}
			aria-describedby={describedby}
			tabindex="-1"
		>
			{@render children()}
		</div>
	</div>
{/if}

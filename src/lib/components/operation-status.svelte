<script lang="ts">
	import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from '@lucide/svelte';

	type OperationStatusKind = 'success' | 'error' | 'partial' | 'info';

	type Props = {
		kind: OperationStatusKind;
		message: string;
		title?: string;
		ondismiss?: () => void;
	};

	let { kind, message, title, ondismiss }: Props = $props();
	let resolvedTitle = $derived(
		title ??
			(
				{
					success: 'Berhasil',
					error: 'Tindakan gagal',
					partial: 'Sebagian berhasil',
					info: 'Informasi'
				} satisfies Record<OperationStatusKind, string>
			)[kind]
	);
	let style = $derived(
		(
			{
				success: 'border-green-300 bg-green-50 text-green-900',
				error: 'border-red-300 bg-red-50 text-red-900',
				partial: 'border-amber-300 bg-amber-50 text-amber-950',
				info: 'border-blue-300 bg-blue-50 text-blue-950'
			} satisfies Record<OperationStatusKind, string>
		)[kind]
	);
</script>

<div
	class="flex items-start gap-3 rounded-lg border p-3 text-sm {style}"
	role={kind === 'error' ? 'alert' : 'status'}
	aria-live={kind === 'error' ? 'assertive' : 'polite'}
>
	{#if kind === 'success'}<CheckCircle2
			class="mt-0.5 h-5 w-5 shrink-0"
			aria-hidden="true"
		/>{:else if kind === 'error'}<AlertCircle
			class="mt-0.5 h-5 w-5 shrink-0"
			aria-hidden="true"
		/>{:else if kind === 'partial'}<AlertTriangle
			class="mt-0.5 h-5 w-5 shrink-0"
			aria-hidden="true"
		/>{:else}<Info class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />{/if}
	<div class="min-w-0 flex-1">
		<p class="font-semibold">{resolvedTitle}</p>
		<p class="mt-0.5">{message}</p>
	</div>
	{#if ondismiss}<button
			type="button"
			onclick={ondismiss}
			class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
			aria-label="Tutup pemberitahuan"><X class="h-4 w-4" /></button
		>{/if}
</div>

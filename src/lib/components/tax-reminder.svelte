<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, Bell, Calendar, Receipt, X } from '@lucide/svelte';
	import { formatDateLong, formatRupiah } from '$lib/utils';
	import { getIndonesianMonthName } from '$lib/tax/config';
	import type { OutstandingMonth } from '$lib/tax/reminder';

	interface TaxReminderData {
		showReminder: boolean;
		reason?: string;
		items?: OutstandingMonth[];
		totalOutstanding?: number;
		urgencyLevel?: 'low' | 'medium' | 'high';
	}

	let reminderData = $state<TaxReminderData | null>(null);
	let dismissed = $state(false);

	// Get urgency-based styles
	function getUrgencyStyles(level: 'low' | 'medium' | 'high') {
		switch (level) {
			case 'high':
				return {
					bg: 'bg-red-50',
					border: 'border-red-200',
					text: 'text-red-800',
					iconBg: 'bg-red-100',
					iconColor: 'text-red-600',
					buttonBg: 'bg-red-600 hover:bg-red-700',
					size: 'py-4' // Larger padding
				};
			case 'medium':
				return {
					bg: 'bg-yellow-50',
					border: 'border-yellow-200',
					text: 'text-yellow-800',
					iconBg: 'bg-yellow-100',
					iconColor: 'text-yellow-600',
					buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
					size: 'py-3' // Medium padding
				};
			default:
				return {
					bg: 'bg-blue-50',
					border: 'border-blue-200',
					text: 'text-blue-800',
					iconBg: 'bg-blue-100',
					iconColor: 'text-blue-600',
					buttonBg: 'bg-blue-600 hover:bg-blue-700',
					size: 'py-3' // Standard padding
				};
		}
	}

	// Tax reminders are useful but non-critical, so load them after the page becomes interactive.
	onMount(() => {
		const controller = new AbortController();
		const loadReminder = async () => {
			try {
				const response = await fetch('/api/tax/reminder', { signal: controller.signal });
				if (!response.ok) throw new Error(`Server error: ${response.status}`);

				const result = (await response.json()) as { data?: TaxReminderData };
				if (result.data) reminderData = result.data;
			} catch (err) {
				if (!controller.signal.aborted) console.error('Error fetching tax reminder:', err);
			}
		};

		if ('requestIdleCallback' in window) {
			const idleId = window.requestIdleCallback(() => void loadReminder(), { timeout: 2000 });
			return () => {
				window.cancelIdleCallback(idleId);
				controller.abort();
			};
		}

		const timeoutId = setTimeout(() => void loadReminder(), 500);
		return () => {
			clearTimeout(timeoutId);
			controller.abort();
		};
	});

	function handleDismiss() {
		dismissed = true;
	}

	// Reactive derived values
	let styles = $derived(
		reminderData?.urgencyLevel
			? getUrgencyStyles(reminderData.urgencyLevel)
			: getUrgencyStyles('low')
	);
	let items = $derived(reminderData?.items ?? []);
	let anyOverdue = $derived(items.some((item) => item.daysUntilDue < 0));

	function dueText(item: OutstandingMonth): string {
		if (item.daysUntilDue < 0) return `lewat batas ${formatDateLong(item.dueDate)}`;
		if (item.daysUntilDue === 0) return `batas hari ini, ${formatDateLong(item.dueDate)}`;
		return `batas ${formatDateLong(item.dueDate)} (${item.daysUntilDue} hari lagi)`;
	}
</script>

{#if !dismissed && reminderData?.showReminder && items.length > 0}
	<div class="border-b {styles.border} {styles.bg} transition-all duration-300">
		<div class="max-w-4xl mx-auto px-4 {styles.size}">
			<div class="flex items-start gap-3">
				<!-- Icon -->
				<div class="flex-shrink-0 {styles.iconBg} rounded-full p-2">
					{#if reminderData.urgencyLevel === 'high'}
						<AlertTriangle class="w-5 h-5 {styles.iconColor}" />
					{:else}
						<Bell class="w-5 h-5 {styles.iconColor}" />
					{/if}
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0">
					<div class="flex items-start justify-between gap-2">
						<div class={styles.text}>
							<p class="font-semibold">
								{anyOverdue ? 'Periksa Estimasi Pajak' : 'Pengingat Estimasi Pajak'}
							</p>
							<p class="text-sm mt-1">
								{items.length === 1
									? 'Estimasi berikut belum lunas menurut catatan Anda:'
									: `${items.length} bulan belum lunas menurut catatan Anda, total`}
								{#if items.length > 1}
									<span class="font-bold">{formatRupiah(reminderData.totalOutstanding ?? 0)}</span>:
								{/if}
							</p>
							<ul class="mt-1 space-y-1 text-sm">
								{#each items as item (item.year + '-' + item.month)}
									<li>
										<a href={item.billingCodeUrl} class="font-medium underline">
											{getIndonesianMonthName(item.month)}
											{item.year}</a
										>:
										{#if item.status === 'underpaid'}
											kurang bayar <span class="font-bold"
												>{formatRupiah(item.outstandingAmount)}</span
											>
										{:else}
											<span class="font-bold">{formatRupiah(item.outstandingAmount)}</span>
										{/if}
										— {dueText(item)}
									</li>
								{/each}
							</ul>
						</div>

						<!-- Close button -->
						<button
							onclick={handleDismiss}
							class="flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
							aria-label="Tutup reminder"
						>
							<X class="w-4 h-4 {styles.text}" />
						</button>
					</div>

					<!-- Actions -->
					<div class="flex flex-wrap gap-2 mt-3">
						<a
							href={items[0].billingCodeUrl}
							class="inline-flex items-center gap-2 {styles.buttonBg} text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
						>
							<Receipt class="w-4 h-4" />
							Panduan Pembayaran
						</a>
						<a
							href="/pajak"
							class="inline-flex items-center gap-2 border border-current {styles.text} bg-transparent hover:opacity-80 px-4 py-2 rounded-md text-sm font-medium transition-colors"
						>
							<Calendar class="w-4 h-4" />
							Lihat Detail Pajak
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

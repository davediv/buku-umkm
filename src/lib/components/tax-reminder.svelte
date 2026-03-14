<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, Bell, Calendar, Receipt, X } from '@lucide/svelte';
	import { formatRupiah } from '$lib/utils';
	import { getIndonesianMonthName } from '$lib/tax/config';

	interface TaxReminderData {
		showReminder: boolean;
		reason?: string;
		previousMonth?: number;
		previousMonthYear?: number;
		taxAmount?: number;
		dueDateDay?: number;
		daysUntilDue?: number;
		urgencyLevel?: 'low' | 'medium' | 'high';
		billingCodeUrl?: string;
	}

	let reminderData = $state<TaxReminderData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
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

	// Fetch reminder data on mount
	onMount(async () => {
		try {
			const response = await fetch('/api/tax/reminder');
			const result = (await response.json()) as { data?: TaxReminderData };

			if (result.data) {
				reminderData = result.data;
			}
		} catch (err) {
			console.error('Error fetching tax reminder:', err);
			error = 'Failed to load reminder';
		} finally {
			loading = false;
		}
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
</script>

{#if loading}
	<!-- Skeleton while loading -->
	<div class="border-b border-yellow-200 bg-yellow-50 animate-pulse">
		<div class="max-w-4xl mx-auto px-4 py-3">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 bg-yellow-200 rounded-full"></div>
				<div class="flex-1 space-y-2">
					<div class="h-4 bg-yellow-200 rounded w-3/4"></div>
					<div class="h-3 bg-yellow-200 rounded w-1/2"></div>
				</div>
			</div>
		</div>
	</div>
{:else if error}
	<!-- Error state -->
	<div class="border-b border-red-200 bg-red-50">
		<div class="max-w-4xl mx-auto px-4 py-3">
			<p class="text-sm text-red-700">{error}</p>
		</div>
	</div>
{:else if !dismissed && reminderData?.showReminder}
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
								{#if reminderData.urgencyLevel === 'high' && reminderData.daysUntilDue === 0}
									Pajak Terlambat!
								{:else}
									Reminder Pajak Bulanan
								{/if}
							</p>
							<p class="text-sm mt-1">
								Pajak {getIndonesianMonthName(reminderData.previousMonth || 0)}
								{reminderData.previousMonthYear}
								sebesar <span class="font-bold">{formatRupiah(reminderData.taxAmount || 0)}</span>
								harus dibayar paling lambat tanggal {reminderData.dueDateDay}.
							</p>
							{#if reminderData.daysUntilDue !== undefined && reminderData.daysUntilDue > 0}
								<p class="text-sm mt-1 opacity-75">
									{#if reminderData.daysUntilDue <= 5}
										Tinggal {reminderData.daysUntilDue} hari lagi!
									{:else}
										Tersisa {reminderData.daysUntilDue} hari
									{/if}
								</p>
							{:else if reminderData.daysUntilDue === 0}
								<p class="text-sm mt-1 font-medium">Sudah terlambat! Segera bayarkan hari ini.</p>
							{/if}
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
							href={reminderData.billingCodeUrl}
							class="inline-flex items-center gap-2 {styles.buttonBg} text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
						>
							<Receipt class="w-4 h-4" />
							Buat Kode Billing
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

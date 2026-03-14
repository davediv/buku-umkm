<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Copy, FileDown, AlertCircle, CheckCircle2 } from '@lucide/svelte';
	import { formatRupiah } from '$lib/tax/engine';
	import { copyToast } from '$lib/components/ui/toast';
	import Toast from '$lib/components/ui/toast/toast.svelte';
	import { jsPDF } from 'jspdf';

	// Get year and month from URL params
	const year = $derived(parseInt($page.params.year || '0'));
	const month = $derived(parseInt($page.params.month || '0'));

	// State
	let loading = $state(true);
	let error = $state<string | null>(null);
	let billingData = $state<{
		kap: string;
		kjs: string;
		npwp: string;
		namaWp: string;
		masaPajak: string;
		bulan: string;
		tahun: number;
		jumlahSetor: number;
		taxableRevenue: number;
		grossRevenue: number;
		status: string;
		isBelowThreshold: boolean;
		taxpayerType: string;
		thresholdAmount: number;
		cumulativeRevenue: number;
		thresholdPercentage: number;
	} | null>(null);

	// Load data on mount
	$effect(() => {
		if (year && month) {
			loadBillingData();
		}
	});

	async function loadBillingData() {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/tax/billing-code/${year}/${month}`);

			if (!response.ok) {
				const errData = (await response.json()) as { error?: string };
				throw new Error(errData.error || 'Failed to fetch billing code data');
			}

			const result = (await response.json()) as { data: typeof billingData };
			billingData = result.data;
		} catch (err) {
			console.error('Error loading billing data:', err);
			error = err instanceof Error ? err.message : 'Failed to load billing data';
		} finally {
			loading = false;
		}
	}

	async function copyToClipboard(value: string, fieldName: string) {
		try {
			await navigator.clipboard.writeText(value);
			copyToast(fieldName);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function exportPDF() {
		if (!billingData) return;

		const doc = new jsPDF();
		const pageWidth = doc.internal.pageSize.getWidth();

		// Title
		doc.setFontSize(16);
		doc.setFont('helvetica', 'bold');
		doc.text('KODE BILLING PAJAK PPH FINAL 0.5%', pageWidth / 2, 20, { align: 'center' });

		// Subtitle
		doc.setFontSize(10);
		doc.setFont('helvetica', 'normal');
		doc.text(`Masa Pajak: ${billingData.masaPajak}`, pageWidth / 2, 28, { align: 'center' });

		// Divider
		doc.setLineWidth(0.5);
		doc.line(20, 32, pageWidth - 20, 32);

		// Data fields
		let yPos = 45;
		const leftMargin = 20;
		const labelCol = 60;

		doc.setFont('helvetica', 'bold');
		doc.text('NPWP', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.text(': ' + (billingData.npwp || '-'), labelCol, yPos);

		yPos += 10;
		doc.setFont('helvetica', 'bold');
		doc.text('Nama Wajib Pajak', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.text(': ' + billingData.namaWp, labelCol, yPos);

		yPos += 10;
		doc.setFont('helvetica', 'bold');
		doc.text('KAP (Kode Akun Pajak)', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.text(': ' + billingData.kap, labelCol, yPos);

		yPos += 10;
		doc.setFont('helvetica', 'bold');
		doc.text('KJS (Kode Jenis Setoran)', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.text(': ' + billingData.kjs, labelCol, yPos);

		yPos += 10;
		doc.setFont('helvetica', 'bold');
		doc.text('Masa Pajak', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.text(': ' + billingData.masaPajak, labelCol, yPos);

		yPos += 10;
		doc.setFont('helvetica', 'bold');
		doc.text('Tahun Pajak', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.text(': ' + billingData.tahun.toString(), labelCol, yPos);

		yPos += 15;
		doc.setFont('helvetica', 'bold');
		doc.text('Jumlah Setor', leftMargin, yPos);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(12);
		doc.text(': Rp ' + formatRupiah(billingData.jumlahSetor).replace('Rp ', ''), labelCol, yPos);

		// Footer
		doc.setFontSize(8);
		doc.setFont('helvetica', 'italic');
		doc.text('Dicetak dari Buku UMKM - Aplikasi Pencatatan Keuangan UMKM', pageWidth / 2, 280, {
			align: 'center'
		});

		// Save
		doc.save(`kode-billing-${billingData.tahun}-${month.toString().padStart(2, '0')}.pdf`);
	}
</script>

<Toast />

<div class="p-4 md:p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<button
			onclick={() => goto('/pajak')}
			class="p-2 hover:bg-muted rounded-lg transition-colors"
			aria-label="Kembali ke halaman pajak"
		>
			<ArrowLeft class="w-5 h-5" />
		</button>
		<div>
			<h1 class="text-2xl font-bold">Kode Billing Pajak</h1>
			<p class="text-sm text-muted-foreground">
				Bulan {billingData?.bulan || ''}
				{billingData?.tahun || year}
			</p>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if error}
		<div
			class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700"
		>
			<AlertCircle class="w-5 h-5 flex-shrink-0" />
			<p>{error}</p>
		</div>
	{:else if billingData}
		{#if billingData.isBelowThreshold}
			<!-- Below threshold notice -->
			<div
				class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-700"
			>
				<CheckCircle2 class="w-5 h-5 flex-shrink-0" />
				<div>
					<p class="font-medium">Tidak Kena Pajak</p>
					<p class="text-sm">
						Penghasilan bulan ini belum melebihi PTKP. Tidak perlu melakukan pembayaran pajak.
					</p>
				</div>
			</div>
		{/if}

		<!-- Billing Code Summary Card -->
		<div class="bg-card border rounded-lg p-6 space-y-6">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">Ringkasan Kode Billing</h2>
				<button
					onclick={exportPDF}
					class="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium transition-colors"
				>
					<FileDown class="w-4 h-4" />
					Ekspor PDF
				</button>
			</div>

			<!-- NPWP -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">NPWP</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg">
						{billingData.npwp || '-'}
					</div>
					<button
						onclick={() => billingData && copyToClipboard(billingData.npwp, 'NPWP')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin NPWP"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Nama WP -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">Nama Wajib Pajak</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-medium">
						{billingData.namaWp || '-'}
					</div>
					<button
						onclick={() => billingData && copyToClipboard(billingData.namaWp, 'Nama WP')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin Nama WP"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- KAP -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">KAP (Kode Akun Pajak)</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg">
						{billingData.kap}
					</div>
					<button
						onclick={() => billingData && copyToClipboard(billingData.kap, 'KAP')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin KAP"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- KJS -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">KJS (Kode Jenis Setoran)</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-lg">
						{billingData.kjs}
					</div>
					<button
						onclick={() => billingData && copyToClipboard(billingData.kjs, 'KJS')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin KJS"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Masa Pajak -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">Masa Pajak</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-medium">
						{billingData.masaPajak}
					</div>
					<button
						onclick={() => billingData && copyToClipboard(billingData.masaPajak, 'Masa Pajak')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin Masa Pajak"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Tahun Pajak -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">Tahun Pajak</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-medium">
						{billingData.tahun}
					</div>
					<button
						onclick={() =>
							billingData && copyToClipboard(billingData.tahun.toString(), 'Tahun Pajak')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin Tahun Pajak"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Jumlah Setor -->
			<div class="space-y-2">
				<label class="text-sm text-muted-foreground">Jumlah Setor</label>
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-muted rounded-lg px-4 py-3 font-bold text-xl">
						{formatRupiah(billingData.jumlahSetor)}
					</div>
					<button
						onclick={() =>
							billingData && copyToClipboard(billingData.jumlahSetor.toString(), 'Jumlah Setor')}
						class="p-3 hover:bg-muted rounded-lg transition-colors"
						aria-label="Salin Jumlah Setor"
					>
						<Copy class="w-5 h-5" />
					</button>
				</div>
			</div>
		</div>

		<!-- Additional Info -->
		<div class="bg-muted/50 rounded-lg p-4 space-y-2">
			<h3 class="font-medium text-sm">Informasi Tambahan</h3>
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div>
					<p class="text-muted-foreground">Pendapatan Kotor</p>
					<p class="font-medium">{formatRupiah(billingData.grossRevenue)}</p>
				</div>
				<div>
					<p class="text-muted-foreground">Pendapatan Kena Pajak</p>
					<p class="font-medium">{formatRupiah(billingData.taxableRevenue)}</p>
				</div>
				<div>
					<p class="text-muted-foreground">Tarif Pajak</p>
					<p class="font-medium">0.5%</p>
				</div>
				<div>
					<p class="text-muted-foreground">Jenis Wajib Pajak</p>
					<p class="font-medium">{billingData.taxpayerType === 'WP_OP' ? 'WPOP' : 'Badan'}</p>
				</div>
			</div>
		</div>
	{/if}
</div>

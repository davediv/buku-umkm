/**
 * SPT Tahunan Export Utilities
 *
 * Excel and PDF export for SPT Tahunan (Annual Tax Return)
 * Based on F-004 tax calculations
 */

import type { TaxpayerType } from '$lib/tax/types';
import { getTaxStatusLabel, getTaxpayerTypeLabel, TAXPAYER_TYPE } from '$lib/tax/config';
import { formatRupiah, formatDateLong } from '$lib/utils';

export type SPTExportFormat = 'xlsx' | 'pdf';

// jsPDF-autotable type
type JsPDFAutoTable = {
	default: (doc: unknown, options: unknown) => void;
};

/**
 * SPT Tahunan data structure from API
 */
export interface SPTMonthData {
	month: number;
	monthName: string;
	grossRevenue: number;
	taxableRevenue: number;
	taxRate: string;
	taxAmount: number;
	taxStatus: string;
	isBelowThreshold: boolean;
}

export interface SPTSummary {
	totalGrossRevenue: number;
	totalTaxableRevenue: number;
	totalTaxDue: number;
	totalTaxPaid: number;
	totalExpenses: number;
	netIncome: number;
	thresholdAmount: number | null;
	thresholdExceeded: boolean;
}

export interface SPTTaxData {
	year: number;
	taxpayerType: TaxpayerType;
	months: SPTMonthData[];
	summary: SPTSummary;
	generatedAt: string;
}

/**
 * Business profile data for export header
 */
export interface SPTBusinessProfile {
	name: string;
	address: string;
	npwp: string;
	ownerName: string;
	taxpayerType: string;
}

/**
 * Get status label in Indonesian
 */
// Re-use getTaxStatusLabel from tax config
const getStatusLabel = getTaxStatusLabel;

/**
 * Generate SPT Tahunan filename
 */
export function generateSPTFilename(year: number, format: SPTExportFormat): string {
	const timestamp = new Date().toISOString().split('T')[0];
	const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
	return `SPT_Tahunan_${year}_${timestamp}.${ext}`;
}

/**
 * Export SPT Tahunan to Excel
 */
export async function exportSPTToExcel(
	sptData: SPTTaxData,
	businessProfile: SPTBusinessProfile | null,
	filename: string
): Promise<void> {
	const XLSX = await import('xlsx');

	const wb = XLSX.utils.book_new();

	// Sheet 1: Ringkasan
	const summaryData: (string | number)[][] = [
		['LAPORAN SPT TAHUNAN'],
		['PPh Final 0.5% (UMKM)'],
		[`Tahun Pajak: ${sptData.year}`],
		[''],
		['DATA WAJIB PAJAK'],
		['Nama Usaha', businessProfile?.name || '-'],
		['Alamat', businessProfile?.address || '-'],
		['NPWP', businessProfile?.npwp || '-'],
		['Pemilik', businessProfile?.ownerName || '-'],
		['Jenis WP', getTaxpayerTypeLabel(sptData.taxpayerType)],
		[''],
		['RINGKASAN TAHUNAN'],
		['Total Pendapatan Kotor', sptData.summary.totalGrossRevenue],
		['Total Pendapatan Kena Pajak', sptData.summary.totalTaxableRevenue],
		['Total PPh Final Terutang', sptData.summary.totalTaxDue],
		['Total PPh Final Dibayar', sptData.summary.totalTaxPaid],
		['Total Pengeluaran', sptData.summary.totalExpenses],
		['Pendapatan Bersih (Laba/Rugi)', sptData.summary.netIncome],
		[''],
		['STATUS'],
		[
			'Batas Threshold (WP OP)',
			sptData.summary.thresholdAmount ? formatRupiah(sptData.summary.thresholdAmount) : 'N/A'
		],
		['Threshold Terlewati', sptData.summary.thresholdExceeded ? 'Ya' : 'Tidak']
	];

	const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
	wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }];
	XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

	// Sheet 2: Bulanan
	const monthlyHeaders = [
		'No',
		'Bulan',
		'Pendapatan Kotor',
		'Pendapatan Kena Pajak',
		'Tarif',
		'PPh Final Terutang',
		'Status',
		'Keterangan'
	];

	const monthlyData: (string | number)[][] = [monthlyHeaders];

	sptData.months.forEach((month, index) => {
		monthlyData.push([
			index + 1,
			month.monthName,
			month.grossRevenue,
			month.taxableRevenue,
			month.taxRate,
			month.taxAmount,
			getStatusLabel(month.taxStatus),
			month.isBelowThreshold ? 'Di bawah threshold' : '-'
		]);
	});

	// Add totals row
	monthlyData.push([
		'',
		'TOTAL',
		sptData.summary.totalGrossRevenue,
		sptData.summary.totalTaxableRevenue,
		'',
		sptData.summary.totalTaxDue,
		'',
		''
	]);

	const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyData);
	wsMonthly['!cols'] = [
		{ wch: 5 }, // No
		{ wch: 15 }, // Bulan
		{ wch: 20 }, // Pendapatan Kotor
		{ wch: 22 }, // Pendapatan Kena Pajak
		{ wch: 10 }, // Tarif
		{ wch: 20 }, // PPh Final Terutang
		{ wch: 12 }, // Status
		{ wch: 20 } // Keterangan
	];
	XLSX.utils.book_append_sheet(wb, wsMonthly, 'Data Bulanan');

	// Sheet 3: Informasi
	const infoData: (string | number)[][] = [
		['INFORMASI EXPORT'],
		['Tanggal Generate', formatDateLong(sptData.generatedAt)],
		['Aplikasi', 'Buku UMKM'],
		[''],
		['CATATAN:'],
		[
			'Data ini dihasilkan berdasarkan perhitungan PPh Final 0.5% sesuai ketentuan perpajakan Indonesia.'
		],
		[
			'Untuk WP Orang Pribadi dengan pendapatan kumulatif di bawah Rp500.000.000,- tidak dikenakan PPh Final.'
		]
	];

	const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
	wsInfo['!cols'] = [{ wch: 30 }, { wch: 50 }];
	XLSX.utils.book_append_sheet(wb, wsInfo, 'Informasi');

	// Export
	XLSX.writeFile(wb, filename);
}

/**
 * Export SPT Tahunan to PDF
 */
export async function exportSPTToPDF(
	sptData: SPTTaxData,
	businessProfile: SPTBusinessProfile | null,
	filename: string
): Promise<void> {
	const { default: jsPDF } = await import('jspdf');
	const autoTable = await import('jspdf-autotable');

	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4'
	});

	const pageWidth = doc.internal.pageSize.getWidth();
	const margin = 20;
	let yPos = margin;

	// Colors
	const primaryColor: [number, number, number] = [0, 51, 102];
	const textColor: [number, number, number] = [51, 51, 51];

	// Helper functions
	const setFont = (style: 'bold' | 'normal' = 'normal', size: number = 10) => {
		doc.setFont('helvetica', style);
		doc.setFontSize(size);
		doc.setTextColor(...textColor);
	};

	const addHeader = () => {
		setFont('bold', 16);
		doc.setTextColor(...primaryColor);
		doc.text('LAPORAN SPT TAHUNAN', pageWidth / 2, yPos, { align: 'center' });
		yPos += 7;

		setFont('bold', 12);
		doc.text('PPh Final 0.5% (UMKM)', pageWidth / 2, yPos, { align: 'center' });
		yPos += 6;

		setFont('normal', 11);
		doc.text(`Tahun Pajak: ${sptData.year}`, pageWidth / 2, yPos, { align: 'center' });
		yPos += 10;
	};

	const addSectionTitle = (title: string) => {
		yPos += 3;
		setFont('bold', 11);
		doc.setTextColor(...primaryColor);
		doc.text(title, margin, yPos);
		yPos += 6;
		doc.setTextColor(...textColor);
	};

	const addInfoRow = (label: string, value: string) => {
		setFont('bold', 10);
		doc.text(label, margin, yPos);
		setFont('normal', 10);
		doc.text(value, margin + 60, yPos);
		yPos += 5;
	};

	// Add header
	addHeader();

	// Business Info Section
	addSectionTitle('DATA WAJIB PAJAK');
	setFont('normal', 10);

	if (businessProfile) {
		addInfoRow('Nama Usaha', businessProfile.name || '-');
		addInfoRow('Alamat', businessProfile.address || '-');
		addInfoRow('NPWP', businessProfile.npwp || '-');
		addInfoRow('Pemilik', businessProfile.ownerName || '-');
		addInfoRow('Jenis WP', getTaxpayerTypeLabel(sptData.taxpayerType));
	} else {
		addInfoRow('Nama Usaha', '-');
		addInfoRow('Alamat', '-');
		addInfoRow('NPWP', '-');
		addInfoRow('Pemilik', '-');
		addInfoRow('Jenis WP', getTaxpayerTypeLabel(sptData.taxpayerType));
	}

	// Summary Section
	addSectionTitle('RINGKASAN TAHUNAN');

	// Summary table
	(autoTable as JsPDFAutoTable).default(doc, {
		startY: yPos,
		head: [['Keterangan', 'Jumlah']],
		body: [
			['Total Pendapatan Kotor', formatRupiah(sptData.summary.totalGrossRevenue)],
			['Total Pendapatan Kena Pajak', formatRupiah(sptData.summary.totalTaxableRevenue)],
			['Total PPh Final Terutang', formatRupiah(sptData.summary.totalTaxDue)],
			['Total PPh Final Dibayar', formatRupiah(sptData.summary.totalTaxPaid)],
			['Total Pengeluaran', formatRupiah(sptData.summary.totalExpenses)],
			['Pendapatan Bersih (Laba/Rugi)', formatRupiah(sptData.summary.netIncome)]
		],
		theme: 'striped',
		headStyles: {
			fillColor: primaryColor,
			textColor: [255, 255, 255],
			fontStyle: 'bold'
		},
		columnStyles: {
			0: { cellWidth: 80, fontStyle: 'bold' },
			1: { cellWidth: 50, halign: 'right' }
		},
		margin: { left: margin, right: margin },
		styles: { fontSize: 9, cellPadding: 3 }
	});

	yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

	// Check if we need a new page for the monthly table
	if (yPos > 200) {
		doc.addPage();
		yPos = margin;
	}

	// Monthly Breakdown Section
	addSectionTitle('REKAPITULASI BULANAN');

	// Monthly data table
	const monthlyTableData = sptData.months.map((month) => [
		month.monthName,
		formatRupiah(month.grossRevenue),
		formatRupiah(month.taxableRevenue),
		month.taxRate,
		formatRupiah(month.taxAmount),
		getStatusLabel(month.taxStatus)
	]);

	// Add total row
	monthlyTableData.push([
		'TOTAL',
		formatRupiah(sptData.summary.totalGrossRevenue),
		formatRupiah(sptData.summary.totalTaxableRevenue),
		'',
		formatRupiah(sptData.summary.totalTaxDue),
		''
	]);

	(autoTable as JsPDFAutoTable).default(doc, {
		startY: yPos,
		head: [['Bulan', 'Pendapatan Kotor', 'Pendapatan Kena Pajak', 'Tarif', 'PPh Final', 'Status']],
		body: monthlyTableData,
		theme: 'striped',
		headStyles: {
			fillColor: primaryColor,
			textColor: [255, 255, 255],
			fontStyle: 'bold'
		},
		columnStyles: {
			0: { cellWidth: 25 },
			1: { cellWidth: 35, halign: 'right' },
			2: { cellWidth: 35, halign: 'right' },
			3: { cellWidth: 15, halign: 'center' },
			4: { cellWidth: 30, halign: 'right' },
			5: { cellWidth: 25, halign: 'center' }
		},
		margin: { left: margin, right: margin },
		styles: { fontSize: 8, cellPadding: 2 }
	});

	yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

	// Threshold info
	if (sptData.taxpayerType === TAXPAYER_TYPE.WP_OP) {
		addSectionTitle('INFORMASI THRESHOLD');

		setFont('normal', 10);
		doc.text(
			`Batas Threshold WP OP: ${sptData.summary.thresholdAmount ? formatRupiah(sptData.summary.thresholdAmount) : 'Rp 500.000.000.000'}`,
			margin,
			yPos
		);
		yPos += 5;
		doc.text(
			`Status Threshold: ${sptData.summary.thresholdExceeded ? 'TERLEWATI' : 'BELUM TERLEWATI'}`,
			margin,
			yPos
		);
		yPos += 10;
	}

	// Footer
	doc.setFontSize(8);
	doc.setTextColor(128, 128, 128);
	doc.text(
		`Dokumen dihasilkan oleh Buku UMKM pada ${formatDateLong(sptData.generatedAt)}`,
		pageWidth / 2,
		285,
		{
			align: 'center'
		}
	);

	// Save
	doc.save(filename);
}

import { formatRupiah, formatDateLong } from '$lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPDFAny = any;

// Type definitions for report data
interface CategoryItem {
	categoryId: string;
	categoryName: string;
	categoryCode?: string;
	total: number;
	percentage: number;
}

interface CategoryBreakdown {
	income: CategoryItem[];
	expense: CategoryItem[];
}

export interface ProfitLossReport {
	period: string;
	periodLabel: string;
	startDate: string;
	endDate: string;
	income: number;
	expense: number;
	profit: number;
	totalBalance: number;
	categoryBreakdown: CategoryBreakdown;
}

interface AssetItem {
	id: string;
	name: string;
	code: string;
	balance: number;
}

interface AssetBreakdown {
	kas: { label: string; items: AssetItem[]; subtotal: number };
	bank: { label: string; items: AssetItem[]; subtotal: number };
	piutangUsaha: { label: string; items: AssetItem[]; subtotal: number };
	piutangDetail: {
		label: string;
		items: { id: string; name: string; remainingAmount: number }[];
		subtotal: number;
	};
	persediaan: { label: string; items: AssetItem[]; subtotal: number };
	aktivaTetap: { label: string; items: AssetItem[]; subtotal: number };
	lainnya: { label: string; items: AssetItem[]; subtotal: number };
}

interface LiabilityBreakdown {
	hutangDetail: {
		label: string;
		items: { id: string; name: string; remainingAmount: number }[];
		subtotal: number;
	};
}

interface EquityComponent {
	name: string;
	amount: number;
}

interface EquityData {
	components: EquityComponent[];
	total: number;
}

interface EquationData {
	assets: number;
	expected: number;
	result: number;
}

export interface BalanceSheetReport {
	dateLabel: string;
	assets: {
		total: number;
		breakdown: AssetBreakdown;
	};
	liabilities: {
		total: number;
		breakdown: LiabilityBreakdown;
	};
	equity: EquityData;
	equation: EquationData;
	isBalanced: boolean;
}

export interface AccountingPolicies {
	basisAccounting: string;
	framework: string;
	currency: string;
}

export interface NotesSection {
	title: string;
	content: string;
}

export interface CatatanReport {
	period: string;
	periodLabel: string;
	startDate: string;
	endDate: string;
	businessProfile: {
		name: string | null;
		address: string | null;
		phone: string | null;
		npwp: string | null;
		businessType: string | null;
		ownerName: string | null;
	} | null;
	accountingPolicies: AccountingPolicies;
	notesSections: NotesSection[];
}

export type ReportType = 'laba-rugi' | 'neraca' | 'catatan';

// Business profile type
interface BusinessProfile {
	name?: string | null;
	address?: string | null;
	phone?: string | null;
	npwp?: string | null;
	ownerName?: string | null;
	logoUrl?: string | null;
}

// Common header for all reports
function addReportHeader(
	doc: JsPDFAny,
	title: string,
	subtitle: string,
	profile: BusinessProfile | null,
	periodLabel: string
): number {
	let yPos = 20;

	// Business name
	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.text(profile?.name || 'Buku UMKM', 20, yPos);
	yPos += 7;

	// Business details
	doc.setFontSize(10);
	doc.setFont('helvetica', 'normal');

	if (profile?.address) {
		doc.text(profile.address, 20, yPos);
		yPos += 4;
	}

	if (profile?.npwp) {
		doc.text(`NPWP: ${profile.npwp}`, 20, yPos);
		yPos += 4;
	}

	yPos += 3;

	// Report title
	doc.setFontSize(14);
	doc.setFont('helvetica', 'bold');
	doc.text(title, 20, yPos);
	yPos += 5;

	// Report subtitle
	doc.setFontSize(10);
	doc.setFont('helvetica', 'normal');
	doc.text(subtitle, 20, yPos);
	yPos += 4;

	// Period
	doc.text(periodLabel, 20, yPos);
	yPos += 8;

	// Horizontal line
	doc.setDrawColor(150);
	doc.line(20, yPos, 190, yPos);
	yPos += 5;

	return yPos;
}

// Add footer
function addReportFooter(doc: JsPDFAny): number {
	const pageHeight = doc.internal.pageSize.height;
	const footerY = pageHeight - 15;

	doc.setFontSize(8);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(128);

	// Footer text
	const footerText = `Dokumen ini dihasilkan secara otomatis oleh Buku UMKM`;
	const dateText = `Tanggal cetak: ${formatDateLong(new Date().toISOString().split('T')[0])}`;

	doc.text(footerText, 20, footerY);
	doc.text(dateText, 20, footerY + 4);

	// Page numbers
	const pageCount = doc.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.text(`Halaman ${i} dari ${pageCount}`, 190, footerY, { align: 'right' });
	}

	return footerY;
}

// Export Laba Rugi (Income Statement) to PDF
export async function exportLabaRugiPDF(
	report: ProfitLossReport,
	profile: BusinessProfile | null,
	filename: string
): Promise<void> {
	const { default: jsPDF } = await import('jspdf');
	await import('jspdf-autotable');

	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4'
	}) as JsPDFAny;

	// Header
	const yPos = addReportHeader(
		doc,
		'LAPORAN LABA RUGI',
		'Income Statement',
		profile,
		report.periodLabel
	);

	// Summary table data
	const summaryData = [
		['Pemasukan (Revenue)', formatRupiah(report.income)],
		['Pengeluaran (Expenses)', formatRupiah(report.expense)],
		['', ''],
		[report.profit >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH', formatRupiah(Math.abs(report.profit))]
	];

	// Summary table
	doc.autoTable({
		startY: yPos,
		body: summaryData,
		theme: 'plain',
		styles: {
			fontSize: 10,
			cellPadding: 3
		},
		columnStyles: {
			0: { fontStyle: 'bold', cellWidth: 120 },
			1: { halign: 'right', cellWidth: 60 }
		},
		margin: { left: 20, right: 20 }
	});

	let currentY = doc.lastAutoTable.finalY + 10;

	// Category breakdown - Income
	if (report.categoryBreakdown.income.length > 0) {
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('Rincian Pemasukan per Kategori', 20, currentY);
		currentY += 5;

		const incomeTableData = report.categoryBreakdown.income.map((cat) => [
			cat.categoryName,
			formatRupiah(cat.total),
			`${cat.percentage.toFixed(1)}%`
		]);

		doc.autoTable({
			startY: currentY,
			head: [['Kategori', 'Jumlah', 'Persentase']],
			body: incomeTableData,
			theme: 'striped',
			headStyles: {
				fillColor: [76, 175, 80],
				fontSize: 9,
				fontStyle: 'bold'
			},
			bodyStyles: {
				fontSize: 9
			},
			columnStyles: {
				0: { cellWidth: 90 },
				1: { halign: 'right', cellWidth: 50 },
				2: { halign: 'right', cellWidth: 30 }
			},
			margin: { left: 20, right: 20 }
		});

		currentY = doc.lastAutoTable.finalY + 8;
	}

	// Category breakdown - Expense
	if (report.categoryBreakdown.expense.length > 0) {
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('Rincian Pengeluaran per Kategori', 20, currentY);
		currentY += 5;

		const expenseTableData = report.categoryBreakdown.expense.map((cat) => [
			cat.categoryName,
			formatRupiah(cat.total),
			`${cat.percentage.toFixed(1)}%`
		]);

		doc.autoTable({
			startY: currentY,
			head: [['Kategori', 'Jumlah', 'Persentase']],
			body: expenseTableData,
			theme: 'striped',
			headStyles: {
				fillColor: [244, 67, 54],
				fontSize: 9,
				fontStyle: 'bold'
			},
			bodyStyles: {
				fontSize: 9
			},
			columnStyles: {
				0: { cellWidth: 90 },
				1: { halign: 'right', cellWidth: 50 },
				2: { halign: 'right', cellWidth: 30 }
			},
			margin: { left: 20, right: 20 }
		});
	}

	// Footer
	addReportFooter(doc);

	// Save
	doc.save(`${filename}.pdf`);
}

// Export Neraca (Balance Sheet) to PDF
export async function exportNeracaPDF(
	report: BalanceSheetReport,
	profile: BusinessProfile | null,
	filename: string
): Promise<void> {
	const { default: jsPDF } = await import('jspdf');
	await import('jspdf-autotable');

	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4'
	}) as JsPDFAny;

	// Header
	const yPos = addReportHeader(
		doc,
		'LAPORAN POSISI KEUANGAN',
		'Balance Sheet',
		profile,
		`Per Tanggal ${report.dateLabel}`
	);

	let currentY = yPos;

	// ASET (Assets)
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('ASET (AKTIVA)', 20, currentY);
	currentY += 6;

	const assetsData: (string | number)[][] = [];

	// Kas
	if (report.assets.breakdown.kas.items.length > 0) {
		assetsData.push([report.assets.breakdown.kas.label, '']);
		report.assets.breakdown.kas.items.forEach((item) => {
			assetsData.push([`   ${item.name}`, formatRupiah(item.balance)]);
		});
		assetsData.push(['', formatRupiah(report.assets.breakdown.kas.subtotal)]);
	}

	// Bank
	if (report.assets.breakdown.bank.items.length > 0) {
		assetsData.push([report.assets.breakdown.bank.label, '']);
		report.assets.breakdown.bank.items.forEach((item) => {
			assetsData.push([`   ${item.name}`, formatRupiah(item.balance)]);
		});
		assetsData.push(['', formatRupiah(report.assets.breakdown.bank.subtotal)]);
	}

	// Piutang Usaha
	if (report.assets.breakdown.piutangUsaha.items.length > 0) {
		assetsData.push([report.assets.breakdown.piutangUsaha.label, '']);
		report.assets.breakdown.piutangUsaha.items.forEach((item) => {
			assetsData.push([`   ${item.name}`, formatRupiah(item.balance)]);
		});
		assetsData.push(['', formatRupiah(report.assets.breakdown.piutangUsaha.subtotal)]);
	}

	// Persediaan
	if (report.assets.breakdown.persediaan.items.length > 0) {
		assetsData.push([report.assets.breakdown.persediaan.label, '']);
		report.assets.breakdown.persediaan.items.forEach((item) => {
			assetsData.push([`   ${item.name}`, formatRupiah(item.balance)]);
		});
		assetsData.push(['', formatRupiah(report.assets.breakdown.persediaan.subtotal)]);
	}

	// Aktiva Tetap
	if (report.assets.breakdown.aktivaTetap.items.length > 0) {
		assetsData.push([report.assets.breakdown.aktivaTetap.label, '']);
		report.assets.breakdown.aktivaTetap.items.forEach((item) => {
			assetsData.push([`   ${item.name}`, formatRupiah(item.balance)]);
		});
		assetsData.push(['', formatRupiah(report.assets.breakdown.aktivaTetap.subtotal)]);
	}

	// Total Assets
	assetsData.push(['TOTAL ASET', formatRupiah(report.assets.total)]);

	doc.autoTable({
		startY: currentY,
		body: assetsData,
		theme: 'plain',
		styles: {
			fontSize: 9,
			cellPadding: 2
		},
		columnStyles: {
			0: { cellWidth: 120 },
			1: { halign: 'right', cellWidth: 50 }
		},
		margin: { left: 20, right: 20 }
	});

	currentY = doc.lastAutoTable.finalY + 8;

	// KEWAJIBAN (Liabilities)
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('KEWAJIBAN (LIABILITIES)', 20, currentY);
	currentY += 6;

	const liabilitiesData: (string | number)[][] = [];

	// Hutang
	if (report.liabilities.breakdown.hutangDetail.items.length > 0) {
		report.liabilities.breakdown.hutangDetail.items.forEach((item) => {
			liabilitiesData.push([item.name, formatRupiah(item.remainingAmount)]);
		});
	} else {
		liabilitiesData.push(['Tidak ada kewajiban', '']);
	}

	liabilitiesData.push(['TOTAL KEWAJIBAN', formatRupiah(report.liabilities.total)]);

	doc.autoTable({
		startY: currentY,
		body: liabilitiesData,
		theme: 'plain',
		styles: {
			fontSize: 9,
			cellPadding: 2
		},
		columnStyles: {
			0: { cellWidth: 120 },
			1: { halign: 'right', cellWidth: 50 }
		},
		margin: { left: 20, right: 20 }
	});

	currentY = doc.lastAutoTable.finalY + 8;

	// EKUITAS (Equity)
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('EKUITAS (EQUITY)', 20, currentY);
	currentY += 6;

	const equityData: (string | number)[][] = [];

	report.equity.components.forEach((comp) => {
		equityData.push([comp.name, formatRupiah(comp.amount)]);
	});

	equityData.push(['TOTAL EKUITAS', formatRupiah(report.equity.total)]);

	doc.autoTable({
		startY: currentY,
		body: equityData,
		theme: 'plain',
		styles: {
			fontSize: 9,
			cellPadding: 2
		},
		columnStyles: {
			0: { cellWidth: 120 },
			1: { halign: 'right', cellWidth: 50 }
		},
		margin: { left: 20, right: 20 }
	});

	currentY = doc.lastAutoTable.finalY + 10;

	// Balance validation
	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	const balanceStatus = report.isBalanced ? 'NERACA SEIMBANG' : 'NERACA TIDAK SEIMBANG';
	const balanceColor = report.isBalanced ? [76, 175, 80] : [244, 67, 54];
	doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
	doc.text(balanceStatus, 20, currentY);

	doc.setTextColor(0, 0, 0);
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.text(`Total Aset: ${formatRupiah(report.equation.assets)}`, 20, currentY + 5);
	doc.text(
		`Total Kewajiban + Ekuitas: ${formatRupiah(report.equation.expected)}`,
		20,
		currentY + 10
	);

	// Footer
	addReportFooter(doc);

	// Save
	doc.save(`${filename}.pdf`);
}

// Export Catatan (Notes to Financial Statements) to PDF
export async function exportCatatanPDF(
	report: CatatanReport,
	profile: BusinessProfile | null,
	filename: string
): Promise<void> {
	const { default: jsPDF } = await import('jspdf');
	await import('jspdf-autotable');

	const doc = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: 'a4'
	}) as JsPDFAny;

	// Header
	const yPos = addReportHeader(
		doc,
		'CATATAN ATAS LAPORAN KEUANGAN',
		'Notes to Financial Statements',
		profile,
		`Periode: ${report.periodLabel}`
	);

	let currentY = yPos;

	// Business Profile Section
	if (report.businessProfile) {
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('Informasi Usaha', 20, currentY);
		currentY += 5;

		doc.setFontSize(9);
		doc.setFont('helvetica', 'normal');

		const profileInfo: string[][] = [];
		if (report.businessProfile.address) {
			profileInfo.push(['Alamat', report.businessProfile.address]);
		}
		if (report.businessProfile.phone) {
			profileInfo.push(['Telepon', report.businessProfile.phone]);
		}
		if (report.businessProfile.npwp) {
			profileInfo.push(['NPWP', report.businessProfile.npwp]);
		}
		if (report.businessProfile.ownerName) {
			profileInfo.push(['Pemilik', report.businessProfile.ownerName]);
		}

		if (profileInfo.length > 0) {
			doc.autoTable({
				startY: currentY,
				body: profileInfo,
				theme: 'plain',
				styles: {
					fontSize: 9,
					cellPadding: 2
				},
				columnStyles: {
					0: { fontStyle: 'bold', cellWidth: 40 },
					1: { cellWidth: 130 }
				},
				margin: { left: 20, right: 20 }
			});

			currentY = doc.lastAutoTable.finalY + 8;
		}
	}

	// Accounting Policies Section
	doc.setFontSize(11);
	doc.setFont('helvetica', 'bold');
	doc.text('Kebijakan Akuntansi', 20, currentY);
	currentY += 5;

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');

	const policiesData = [
		['Dasar Akuntansi', report.accountingPolicies.basisAccounting],
		['Kerangka Akuntansi', report.accountingPolicies.framework],
		['Mata Uang', report.accountingPolicies.currency]
	];

	doc.autoTable({
		startY: currentY,
		body: policiesData,
		theme: 'plain',
		styles: {
			fontSize: 9,
			cellPadding: 2
		},
		columnStyles: {
			0: { fontStyle: 'bold', cellWidth: 50 },
			1: { cellWidth: 120 }
		},
		margin: { left: 20, right: 20 }
	});

	currentY = doc.lastAutoTable.finalY + 10;

	// Notes Sections
	doc.setFontSize(11);
	doc.setFont('helvetica', 'bold');
	doc.text('Catatan', 20, currentY);
	currentY += 5;

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');

	report.notesSections.forEach((section) => {
		// Check if we need a new page
		if (currentY > 250) {
			doc.addPage();
			currentY = 20;
		}

		doc.setFont('helvetica', 'bold');
		doc.text(section.title, 20, currentY);
		currentY += 4;

		doc.setFont('helvetica', 'normal');

		// Split content into lines for proper wrapping
		const splitContent = doc.splitTextToSize(section.content, 170);
		doc.text(splitContent, 20, currentY);
		currentY += splitContent.length * 4 + 4;
	});

	// Footer
	addReportFooter(doc);

	// Save
	doc.save(`${filename}.pdf`);
}

// Re-export from shared utility for backward compatibility
export { generateExportFilename as generatePDFFilename } from '$lib/utils/export';

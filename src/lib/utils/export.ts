export type ExportFormat = 'xlsx' | 'csv';

export type TransactionForExport = {
	date: string;
	type: 'income' | 'expense' | 'transfer';
	amount: number;
	description: string | null;
	account: { name: string } | null;
	category: { name: string } | null;
	toAccount: { name: string } | null;
	isTaxed: boolean;
	taxAmount: number;
};

interface TransactionExportRow {
	date: string;
	type: 'income' | 'expense' | 'transfer';
	typeLabel: string;
	description: string;
	category: string;
	account: string;
	toAccount?: string;
	amount: number;
	isTaxed: boolean;
	taxAmount: number;
}

export function formatDateForExport(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

function convertToExportRows(transactions: TransactionForExport[]): TransactionExportRow[] {
	return transactions.map((t) => ({
		date: formatDateForExport(t.date),
		type: t.type,
		typeLabel:
			t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
		description: t.description || '-',
		category: t.category?.name || '-',
		account: t.account?.name || '-',
		toAccount: t.toAccount?.name,
		amount: t.amount,
		isTaxed: t.isTaxed,
		taxAmount: t.taxAmount
	}));
}

export async function exportTransactions(
	transactions: TransactionForExport[],
	format: ExportFormat,
	filename: string
): Promise<void> {
	const rows = convertToExportRows(transactions);

	// Create worksheet data with headers
	const headers = [
		'Tanggal',
		'Jenis',
		'Kategori',
		'Akun',
		'Ke Akun',
		'Keterangan',
		'Jumlah',
		'Pajak',
		'Jumlah Pajak'
	];

	const wsData: (string | number)[][] = [headers];

	rows.forEach((row) => {
		wsData.push([
			row.date,
			row.typeLabel,
			row.category,
			row.account,
			row.toAccount || '-',
			row.description,
			row.amount,
			row.isTaxed ? 'Ya' : 'Tidak',
			row.taxAmount > 0 ? row.taxAmount : '-'
		]);
	});

	// Dynamic import xlsx to reduce initial bundle size
	const XLSX = await import('xlsx');

	// Create workbook and worksheet
	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.aoa_to_sheet(wsData);

	// Set column widths
	ws['!cols'] = [
		{ wch: 20 }, // Tanggal
		{ wch: 12 }, // Jenis
		{ wch: 20 }, // Kategori
		{ wch: 20 }, // Akun
		{ wch: 20 }, // Ke Akun
		{ wch: 30 }, // Keterangan
		{ wch: 18 }, // Jumlah
		{ wch: 10 }, // Pajak
		{ wch: 15 } // Jumlah Pajak
	];

	// Add worksheet to workbook
	XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');

	if (format === 'xlsx') {
		// Export as Excel
		XLSX.writeFile(wb, `${filename}.xlsx`);
	} else {
		// Export as CSV with UTF-8 BOM
		const csv = XLSX.utils.sheet_to_csv(ws);
		const bom = '\uFEFF';
		const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${filename}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
}

export function generateExportFilename(prefix: string): string {
	const now = new Date();
	const dateStr = now
		.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric'
		})
		.replace(/\//g, '-');
	return `${prefix}_${dateStr}`;
}

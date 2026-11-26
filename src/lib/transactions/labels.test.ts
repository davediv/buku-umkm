import { describe, expect, it } from 'vitest';
import { transactionCategoryLabel, transactionKindLabel } from './labels';

describe('transaction labels', () => {
	it('names ordinary income and expense rows by type and category', () => {
		const sale = { type: 'income', category: { name: 'Penjualan Makanan' } };
		expect([transactionKindLabel(sale), transactionCategoryLabel(sale)]).toEqual([
			'Pemasukan',
			'Penjualan Makanan'
		]);
		expect(transactionCategoryLabel({ type: 'expense' })).toBe('Tanpa kategori');
	});

	it('names both legs of a transfer as a transfer', () => {
		const leg = { type: 'income', toAccountId: 'kas' };
		expect([transactionKindLabel(leg), transactionCategoryLabel(leg)]).toEqual([
			'Transfer',
			'Transfer'
		]);
	});

	it('names debt payments and loan principal as cash movements, not income or expense', () => {
		const loanIn = { type: 'income', debtId: 'loan-1' };
		const paymentOut = { type: 'expense', debtId: 'debt-2' };
		expect(transactionKindLabel(loanIn)).toBe('Kas masuk (utang/piutang)');
		expect(transactionKindLabel(paymentOut)).toBe('Kas keluar (utang/piutang)');
		expect(transactionCategoryLabel(loanIn, '-')).toBe('Utang & piutang');
	});
});

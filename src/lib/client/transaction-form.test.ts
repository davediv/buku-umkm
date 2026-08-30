import { describe, expect, it } from 'vitest';
import { validateTransactionForm } from './transaction-form';

describe('shared transaction form validation', () => {
	it('normalizes an Indonesian-formatted amount', () => {
		expect(
			validateTransactionForm({ amount: '125.000', accountId: 'account-1', date: '2026-08-30' })
		).toEqual({ valid: true, amount: 125_000 });
	});

	it('uses the same required rules for create and edit callers', () => {
		expect(
			validateTransactionForm({ amount: '0', accountId: 'account-1', date: '2026-08-30' })
		).toMatchObject({ valid: false, message: 'Jumlah harus lebih dari 0' });
		expect(
			validateTransactionForm({ amount: '1000', accountId: '', date: '2026-08-30' })
		).toMatchObject({ valid: false, message: 'Pilih kas atau rekening terlebih dahulu' });
		expect(
			validateTransactionForm({ amount: '1000', accountId: 'account-1', date: '' })
		).toMatchObject({ valid: false, message: 'Tanggal transaksi wajib diisi' });
	});
});

import { describe, expect, it } from 'vitest';
import {
	parseCreateDebt,
	parseCreateTransaction,
	parseDebtPayment,
	parseUpdateTransaction,
	requireIdempotencyKey
} from './contracts';

describe('financial command contracts', () => {
	it('normalizes a valid transaction request', () => {
		expect(
			parseCreateTransaction({
				type: 'income',
				amount: 100_000,
				account_id: ' account-1 ',
				date: '2026-08-30',
				description: ' Penjualan ',
				reference_number: ' INV/001 ',
				notes: ' Dibayar tunai '
			})
		).toEqual({
			type: 'income',
			amount: 100_000,
			accountId: 'account-1',
			categoryId: null,
			date: '2026-08-30',
			description: 'Penjualan',
			referenceNumber: 'INV/001',
			notes: 'Dibayar tunai'
		});
	});

	it('rejects fractional money and post-save account/type changes', () => {
		expect(() =>
			parseCreateTransaction({
				type: 'income',
				amount: 10.5,
				account_id: 'account-1',
				date: '2026-08-30'
			})
		).toThrow(/Rupiah bulat/);
		expect(() => parseUpdateTransaction({ account_id: 'account-2' })).toThrow(
			/Jenis dan akun transaksi tidak dapat diubah/
		);
	});

	it('requires an explicit retry key for create commands', () => {
		const valid = new Request('https://example.test', {
			headers: { 'Idempotency-Key': 'request-123' }
		});
		const missing = new Request('https://example.test');

		expect(requireIdempotencyKey(valid)).toBe('request-123');
		expect(() => requireIdempotencyKey(missing)).toThrow(/Idempotency-Key wajib/);
	});

	it('defaults a debt to trade and requires an account only for loans', () => {
		const base = { type: 'hutang', contact_name: 'Koperasi', amount: 500_000, date: '2026-08-30' };

		expect(parseCreateDebt(base)).toMatchObject({ kind: 'trade', accountId: null });
		expect(parseCreateDebt({ ...base, kind: 'loan', account_id: ' kas-1 ' })).toMatchObject({
			kind: 'loan',
			accountId: 'kas-1'
		});
		expect(() => parseCreateDebt({ ...base, kind: 'loan' })).toThrow(/Akun wajib diisi/);
		expect(() => parseCreateDebt({ ...base, account_id: 'kas-1' })).toThrow(
			/Akun hanya diisi untuk pinjaman/
		);
		expect(() => parseCreateDebt({ ...base, kind: 'gift' })).toThrow(/Jenis catatan tidak valid/);
	});

	it('reads a payment as principal plus optional interest', () => {
		const base = { date: '2026-08-30', account_id: 'kas-1' };

		expect(parseDebtPayment({ ...base, amount: 100_000 })).toMatchObject({
			amount: 100_000,
			interestAmount: 0
		});
		expect(parseDebtPayment({ ...base, amount: 100_000, interest_amount: 5_000 })).toMatchObject({
			amount: 100_000,
			interestAmount: 5_000
		});
		// Interest alone: the principal may then be 0 or left out.
		expect(parseDebtPayment({ ...base, amount: 0, interest_amount: 5_000 })).toMatchObject({
			amount: 0,
			interestAmount: 5_000
		});
		expect(parseDebtPayment({ ...base, interest_amount: 5_000 })).toMatchObject({ amount: 0 });
		expect(() => parseDebtPayment({ ...base, amount: 0 })).toThrow(/lebih dari 0/);
		expect(() => parseDebtPayment({ ...base, amount: 0, interest_amount: 0 })).toThrow(
			/lebih dari 0/
		);
		expect(() => parseDebtPayment({ ...base, amount: 100, interest_amount: -1 })).toThrow(
			/Bunga harus berupa Rupiah bulat/
		);
		expect(() => parseDebtPayment({ ...base, amount: 100, interest_amount: 1.5 })).toThrow(
			/Bunga harus berupa Rupiah bulat/
		);
		expect(() => parseDebtPayment({ ...base, amount: -5, interest_amount: 100 })).toThrow(
			/Pokok harus berupa Rupiah bulat/
		);
	});
});

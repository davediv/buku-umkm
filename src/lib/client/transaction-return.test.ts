import { describe, expect, it } from 'vitest';
import { getSafeTransactionReturn } from './transaction-return';

describe('transaction dependency return navigation', () => {
	it('accepts transaction create and edit destinations', () => {
		expect(getSafeTransactionReturn('/transaksi/tambah')).toBe('/transaksi/tambah');
		expect(getSafeTransactionReturn('/transaksi/txn_123?asal=kategori')).toBe(
			'/transaksi/txn_123?asal=kategori'
		);
	});

	it('rejects external and unrelated destinations', () => {
		expect(getSafeTransactionReturn('https://evil.example/transaksi/tambah')).toBeNull();
		expect(getSafeTransactionReturn('//evil.example/transaksi/tambah')).toBeNull();
		expect(getSafeTransactionReturn('/dashboard')).toBeNull();
		expect(getSafeTransactionReturn('/transaksi/../../pengaturan')).toBeNull();
	});
});

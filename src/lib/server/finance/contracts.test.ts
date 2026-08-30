import { describe, expect, it } from 'vitest';
import { parseCreateTransaction, parseUpdateTransaction, requireIdempotencyKey } from './contracts';

describe('financial command contracts', () => {
	it('normalizes a valid transaction request', () => {
		expect(
			parseCreateTransaction({
				type: 'income',
				amount: 100_000,
				account_id: ' account-1 ',
				date: '2026-08-30',
				description: ' Penjualan '
			})
		).toEqual({
			type: 'income',
			amount: 100_000,
			accountId: 'account-1',
			categoryId: null,
			date: '2026-08-30',
			description: 'Penjualan'
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
});

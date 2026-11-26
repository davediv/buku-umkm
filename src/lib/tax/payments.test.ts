import { describe, expect, it } from 'vitest';
import {
	isWholeRupiah,
	MAX_RUPIAH_INPUT,
	normalizePaymentReference,
	reconcilePayment
} from './payments';

describe('isWholeRupiah', () => {
	it('accepts whole JSON numbers from 0 to the cap', () => {
		expect(isWholeRupiah(0)).toBe(true);
		expect(isWholeRupiah(750_000)).toBe(true);
		expect(isWholeRupiah(MAX_RUPIAH_INPUT)).toBe(true);
	});

	it.each([
		['a formatted string', '750.000'],
		['a numeric string', '750000'],
		['a negative amount', -1],
		['a fraction', 1.5],
		['an amount above the cap', MAX_RUPIAH_INPUT + 1],
		['NaN', Number.NaN],
		['null', null]
	])('rejects %s', (_label, value) => {
		expect(isWholeRupiah(value)).toBe(false);
	});
});

describe('reconcilePayment', () => {
	const paid = (paidAmount: number | null, taxAmount = 500_000) => ({
		status: 'paid',
		taxAmount,
		paidAmount
	});

	it('is paid when the recorded payment covers the recomputed tax', () => {
		expect(reconcilePayment(500_000, paid(500_000))).toEqual({
			status: 'paid',
			paidAmount: 500_000,
			outstandingAmount: 0
		});
	});

	it('is underpaid when the recomputed tax now exceeds what was paid', () => {
		expect(reconcilePayment(650_000, paid(500_000))).toEqual({
			status: 'underpaid',
			paidAmount: 500_000,
			outstandingAmount: 150_000
		});
	});

	it('treats a legacy record without paid amount as paying its stored estimate', () => {
		expect(reconcilePayment(600_000, paid(null, 500_000)).outstandingAmount).toBe(100_000);
	});

	it('is unpaid when tax is due and nothing is recorded as paid', () => {
		expect(reconcilePayment(500_000, undefined)).toEqual({
			status: 'unpaid',
			paidAmount: null,
			outstandingAmount: 500_000
		});
		expect(
			reconcilePayment(500_000, { status: 'unpaid', taxAmount: 0, paidAmount: null }).status
		).toBe('unpaid');
	});

	it('has nothing to pay when there is no tax', () => {
		expect(reconcilePayment(0, undefined).status).toBe('none');
	});
});

describe('normalizePaymentReference', () => {
	it('accepts a 15-digit kode billing, ignoring spaces and dashes', () => {
		expect(normalizePaymentReference('1234 5678-9012 345')).toEqual({
			ok: true,
			value: '123456789012345'
		});
	});

	it('accepts a 16-character NTPN and upper-cases it', () => {
		expect(normalizePaymentReference('0a1b2c3d4e5f6a7b')).toEqual({
			ok: true,
			value: '0A1B2C3D4E5F6A7B'
		});
	});

	it('treats an empty or missing reference as none', () => {
		expect(normalizePaymentReference('  ')).toEqual({ ok: true, value: null });
		expect(normalizePaymentReference(undefined)).toEqual({ ok: true, value: null });
		expect(normalizePaymentReference(null)).toEqual({ ok: true, value: null });
	});

	it.each([['12345'], ['12345678901234X'], ['ABCDEFGHIJKLMNOPQ'], [123456789012345]])(
		'rejects %s',
		(value) => {
			expect(normalizePaymentReference(value).ok).toBe(false);
		}
	);
});

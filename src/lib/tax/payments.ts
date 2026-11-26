import { TAX_STATUS } from './config';

/**
 * Upper bound for a Rupiah amount typed into a tax form (Rp1 triliun). Far above any
 * turnover or tax a UMKM bookkeeping user enters, so it only rejects typos and abuse.
 */
export const MAX_RUPIAH_INPUT = 1_000_000_000_000;

/** A JSON number that is a whole Rupiah amount from 0 to `max`. Strings are rejected. */
export function isWholeRupiah(value: unknown, max = MAX_RUPIAH_INPUT): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

export type PaymentStatus = 'none' | 'unpaid' | 'paid' | 'underpaid';

export interface PaymentRecordLike {
	status: string;
	taxAmount: number;
	paidAmount: number | null;
}

export interface PaymentState {
	status: PaymentStatus;
	/** What the taxpayer recorded as paid; null when the month is not marked paid. */
	paidAmount: number | null;
	/** Recomputed tax not yet covered by the recorded payment. */
	outstandingAmount: number;
}

/**
 * Compares the tax recomputed from today's books with what was recorded as paid. A month
 * marked paid is underpaid when later entries raise its tax above the amount paid.
 */
export function reconcilePayment(
	estimatedTax: number,
	record: PaymentRecordLike | null | undefined
): PaymentState {
	if (record?.status === TAX_STATUS.PAID) {
		// Records from before paid_amount existed assumed the estimate was paid in full.
		const paidAmount = record.paidAmount ?? record.taxAmount;
		const outstandingAmount = Math.max(0, estimatedTax - paidAmount);
		return { status: outstandingAmount > 0 ? 'underpaid' : 'paid', paidAmount, outstandingAmount };
	}
	if (estimatedTax > 0) {
		return { status: 'unpaid', paidAmount: null, outstandingAmount: estimatedTax };
	}
	return { status: 'none', paidAmount: null, outstandingAmount: 0 };
}

/** Kode billing: 15 digits. NTPN: 16 letters or digits. */
const BILLING_CODE_PATTERN = /^\d{15}$/;
const NTPN_PATTERN = /^[0-9A-Z]{16}$/;

/**
 * Normalizes an optional payment reference: a kode billing or an NTPN, with spaces and
 * dashes removed and letters upper-cased. Empty input means none was given.
 */
export function normalizePaymentReference(
	value: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
	if (value === undefined || value === null) return { ok: true, value: null };
	if (typeof value !== 'string') {
		return { ok: false, error: 'Kode billing atau NTPN harus berupa teks.' };
	}
	const reference = value.replace(/[\s-]/g, '').toUpperCase();
	if (reference === '') return { ok: true, value: null };
	if (BILLING_CODE_PATTERN.test(reference) || NTPN_PATTERN.test(reference)) {
		return { ok: true, value: reference };
	}
	return {
		ok: false,
		error: 'Isi kode billing 15 digit angka atau NTPN 16 karakter huruf/angka.'
	};
}

/**
 * Reads a Rupiah amount typed the Indonesian way. Dots and spaces are thousand
 * separators ("1.500.000", "Rp 50.000"), so only the digits count. Returns null
 * when the text holds no digits.
 */
export function parseRupiahInput(text: string): number | null {
	const digits = text.replace(/\D/g, '');
	if (!digits) return null;
	const value = Number(digits);
	return Number.isSafeInteger(value) ? value : null;
}

/** Formats a whole Rupiah amount with Indonesian thousand separators, without "Rp". */
export function formatRupiahInput(value: number | null | undefined): string {
	return value === null || value === undefined ? '' : value.toLocaleString('id-ID');
}

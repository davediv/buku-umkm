import { describe, expect, it } from 'vitest';
import { formatRupiahInput, parseRupiahInput } from './money';

describe('Rupiah input parsing', () => {
	it('treats dots and spaces as thousand separators', () => {
		expect(parseRupiahInput('50.000')).toBe(50_000);
		expect(parseRupiahInput('1.500.000')).toBe(1_500_000);
		expect(parseRupiahInput('Rp 750.000')).toBe(750_000);
		expect(parseRupiahInput('2500000')).toBe(2_500_000);
	});

	it('returns null without digits or beyond safe integers', () => {
		expect(parseRupiahInput('')).toBeNull();
		expect(parseRupiahInput('Rp')).toBeNull();
		expect(parseRupiahInput('9'.repeat(20))).toBeNull();
	});

	it('formats amounts for display while typing', () => {
		expect(formatRupiahInput(1_500_000)).toBe('1.500.000');
		expect(formatRupiahInput(0)).toBe('0');
		expect(formatRupiahInput(null)).toBe('');
	});
});

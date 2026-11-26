import { describe, expect, it } from 'vitest';
import { formatNPWP, validateNPWP } from './crypto';

describe('NPWP formatting', () => {
	it('formats the legacy 15-digit NPWP the way DJP prints it', () => {
		expect(formatNPWP('012345678901234')).toBe('01.234.567.8-901.234');
		expect(formatNPWP('01.234.567.8-901.234')).toBe('01.234.567.8-901.234');
	});

	it('keeps the 16-digit NPWP as plain digits', () => {
		expect(formatNPWP('3171012345678901')).toBe('3171012345678901');
	});

	it('accepts only 15 or 16 digits', () => {
		expect(validateNPWP('01.234.567.8-901.234').valid).toBe(true);
		expect(validateNPWP('3171012345678901').valid).toBe(true);
		expect(validateNPWP('12345').valid).toBe(false);
	});
});

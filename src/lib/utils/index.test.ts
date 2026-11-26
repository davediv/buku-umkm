import { describe, expect, it } from 'vitest';
import {
	formatDate,
	formatDateShort,
	formatDateSlash,
	formatPercent,
	getComparisonText
} from './index';

describe('calendar date formatting', () => {
	it('shows the stored day regardless of the viewer time zone', () => {
		// The test runs in the process time zone; TZ=America/Los_Angeles reproduces the old bug.
		expect(formatDate('2026-11-01')).toBe('1 Nov 2026');
		expect(formatDateShort('2026-11-01')).toBe('1 Nov');
		expect(formatDateSlash('2026-11-01')).toBe('01/11/2026');
		expect(formatDate(null)).toBe('-');
	});
});

describe('percentage formatting', () => {
	it('uses the Indonesian decimal comma', () => {
		expect(formatPercent(55.555)).toBe('55,6%');
		expect(formatPercent(100)).toBe('100,0%');
		expect(getComparisonText(12.34).text).toBe('Naik 12,3%');
		expect(getComparisonText(-5).text).toBe('Turun 5,0%');
	});
});

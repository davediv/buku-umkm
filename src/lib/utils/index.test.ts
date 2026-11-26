import { describe, expect, it } from 'vitest';
import { formatDate, formatDateShort, formatDateSlash } from './index';

describe('calendar date formatting', () => {
	it('shows the stored day regardless of the viewer time zone', () => {
		// The test runs in the process time zone; TZ=America/Los_Angeles reproduces the old bug.
		expect(formatDate('2026-11-01')).toBe('1 Nov 2026');
		expect(formatDateShort('2026-11-01')).toBe('1 Nov');
		expect(formatDateSlash('2026-11-01')).toBe('01/11/2026');
		expect(formatDate(null)).toBe('-');
	});
});

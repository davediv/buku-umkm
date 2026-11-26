import { describe, expect, it } from 'vitest';
import { jakartaToday } from './period';

describe('jakartaToday', () => {
	it('is already December at 05:00 WIB on 1 December', () => {
		// 05:00 WIB = 22:00 UTC the day before.
		expect(jakartaToday(new Date('2026-11-30T22:00:00Z'))).toEqual({
			date: '2026-12-01',
			year: 2026,
			month: 12,
			day: 1
		});
	});

	it('is already the new year from 00:00 WIB on 1 January', () => {
		const today = jakartaToday(new Date('2026-12-31T17:00:00Z'));
		expect(today.year).toBe(2027);
		expect(today.month).toBe(1);
		expect(today.day).toBe(1);
	});

	it('is still the old day just before midnight WIB', () => {
		expect(jakartaToday(new Date('2026-12-31T16:59:59Z')).date).toBe('2026-12-31');
	});
});

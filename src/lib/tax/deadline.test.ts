import { describe, expect, it } from 'vitest';
import {
	daysBetween,
	hasVerifiedHolidayList,
	isTaxHoliday,
	nextWorkingDay,
	paymentDueDate
} from './deadline';

describe('paymentDueDate (PMK 81/2024 Pasal 94 and 100)', () => {
	it('is the 15th of the next month when that is a working day', () => {
		expect(paymentDueDate(2026, 9)).toBe('2026-10-15'); // Thursday
	});

	it('moves past a Sunday to Monday', () => {
		expect(paymentDueDate(2026, 10)).toBe('2026-11-16'); // 15 Nov 2026 is a Sunday
	});

	it('moves past a weekend, a cuti bersama and a national holiday', () => {
		// 15 Feb 2026 Sunday, 16 Feb cuti bersama Imlek, 17 Feb Tahun Baru Imlek.
		expect(paymentDueDate(2026, 1)).toBe('2026-02-18');
	});

	it('moves past a Friday cuti bersama and the weekend after it', () => {
		// 15 May 2026 is cuti bersama Kenaikan Yesus Kristus (Friday).
		expect(paymentDueDate(2026, 4)).toBe('2026-05-18');
	});

	it('moves past a Saturday and the Proklamasi holiday', () => {
		// 15 Aug 2026 Saturday, 16 Sunday, 17 Proklamasi Kemerdekaan.
		expect(paymentDueDate(2026, 7)).toBe('2026-08-18');
	});

	it('follows the 2027 list: a Monday cuti bersama', () => {
		// 15 Mar 2027 is cuti bersama Idulfitri.
		expect(paymentDueDate(2027, 2)).toBe('2027-03-16');
	});

	it('follows the 2027 list through a week of holidays', () => {
		// 15-16 May 2027 weekend, 17 Iduladha, 18-19 cuti bersama, 20 Waisak.
		expect(paymentDueDate(2027, 4)).toBe('2027-05-21');
	});

	it('rolls December over to January of the next year', () => {
		expect(paymentDueDate(2026, 12)).toBe('2027-01-15'); // Friday
	});

	it('shifts only for weekends in a year without a verified holiday list', () => {
		expect(hasVerifiedHolidayList(2028)).toBe(false);
		expect(paymentDueDate(2027, 12)).toBe('2028-01-17'); // 15 Jan 2028 is a Saturday
		expect(paymentDueDate(2028, 9)).toBe('2028-10-16'); // 15 Oct 2028 is a Sunday
		expect(paymentDueDate(2028, 10)).toBe('2028-11-15'); // Wednesday
	});
});

describe('isTaxHoliday and nextWorkingDay', () => {
	it('treats weekends, national holidays and cuti bersama as holidays', () => {
		expect(isTaxHoliday('2026-11-28')).toBe(true); // Saturday
		expect(isTaxHoliday('2026-12-24')).toBe(true); // cuti bersama
		expect(isTaxHoliday('2026-12-25')).toBe(true); // Natal
		expect(isTaxHoliday('2026-12-23')).toBe(false); // Wednesday
	});

	it('returns a working day unchanged', () => {
		expect(nextWorkingDay('2026-12-23')).toBe('2026-12-23');
		expect(nextWorkingDay('2026-12-24')).toBe('2026-12-28');
	});
});

describe('daysBetween', () => {
	it('counts calendar days in either direction', () => {
		expect(daysBetween('2026-11-27', '2026-12-01')).toBe(4);
		expect(daysBetween('2026-12-01', '2026-11-27')).toBe(-4);
	});
});

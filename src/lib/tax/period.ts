import { todayInJakarta } from '$lib/shared/dates';

export interface CalendarDay {
	/** ISO date, YYYY-MM-DD. */
	date: string;
	year: number;
	/** 1-12 */
	month: number;
	day: number;
}

/**
 * Today on the Jakarta (WIB) calendar. Tax periods, deadlines and "this year" follow the
 * Indonesian calendar, not UTC: at 05:00 WIB on 1 December it is already December.
 */
export function jakartaToday(now = new Date()): CalendarDay {
	const date = todayInJakarta(now);
	const [year, month, day] = date.split('-').map(Number);
	return { date, year, month, day };
}

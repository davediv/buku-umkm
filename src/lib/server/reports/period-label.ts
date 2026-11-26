import { INDONESIAN_MONTHS } from '$lib/tax/config';
import type { ReportPeriod } from '$lib/server/db/queries/ledger';

const QUARTERS = ['I', 'II', 'III', 'IV'];

function parts(date: string) {
	const [year, month, day] = date.split('-').map(Number);
	return { year, month, day, monthName: INDONESIAN_MONTHS[month - 1] };
}

function previousDay(date: string): string {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() - 1);
	return value.toISOString().slice(0, 10);
}

/**
 * Names the calendar period a report covers, e.g. "November 2026" or "23–29 November 2026",
 * so a printed or exported report says which days it is about. `range.end` is exclusive.
 */
export function describeReportPeriod(
	period: ReportPeriod,
	range: { start: string; end: string }
): string {
	const start = parts(range.start);
	const last = parts(previousDay(range.end));
	switch (period) {
		case 'daily':
			return `${start.day} ${start.monthName} ${start.year}`;
		case 'weekly':
			if (start.year !== last.year) {
				return `${start.day} ${start.monthName} ${start.year} – ${last.day} ${last.monthName} ${last.year}`;
			}
			if (start.month !== last.month) {
				return `${start.day} ${start.monthName} – ${last.day} ${last.monthName} ${last.year}`;
			}
			return `${start.day}–${last.day} ${start.monthName} ${start.year}`;
		case 'monthly':
			return `${start.monthName} ${start.year}`;
		case 'quarterly':
			return `Triwulan ${QUARTERS[Math.floor((start.month - 1) / 3)]} ${start.year}`;
		case 'yearly':
			return `Tahun ${start.year}`;
	}
}

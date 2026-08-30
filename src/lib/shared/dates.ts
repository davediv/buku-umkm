const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function todayInJakarta(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

export function isIsoCalendarDate(value: string): boolean {
	if (!ISO_DATE_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dateFromTimestamp(value: Date | number | string): string {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? '1970-01-01' : date.toISOString().slice(0, 10);
}

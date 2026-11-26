import { describe, expect, it } from 'vitest';
import { reportPeriodRanges } from '$lib/server/db/queries/ledger';
import { describeReportPeriod } from './period-label';

const label = (period: Parameters<typeof describeReportPeriod>[0], today: string) =>
	describeReportPeriod(period, reportPeriodRanges(period, today).current);

describe('report period labels', () => {
	it('names the actual days, month, quarter or year', () => {
		expect(label('daily', '2026-11-27')).toBe('27 November 2026');
		expect(label('weekly', '2026-11-27')).toBe('23–29 November 2026');
		expect(label('monthly', '2026-11-27')).toBe('November 2026');
		expect(label('quarterly', '2026-11-27')).toBe('Triwulan IV 2026');
		expect(label('yearly', '2026-11-27')).toBe('Tahun 2026');
	});

	it('spells out weeks that cross a month or a year', () => {
		expect(label('weekly', '2026-12-02')).toBe('30 November – 6 Desember 2026');
		expect(label('weekly', '2026-12-31')).toBe('28 Desember 2026 – 3 Januari 2027');
	});
});

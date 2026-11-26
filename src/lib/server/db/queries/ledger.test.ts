import { describe, expect, it } from 'vitest';
import { reportPeriodRanges } from './ledger';

describe('reportPeriodRanges', () => {
	it('treats daily as today against yesterday', () => {
		expect(reportPeriodRanges('daily', '2026-03-01')).toEqual({
			current: { start: '2026-03-01', end: '2026-03-02' },
			previous: { start: '2026-02-28', end: '2026-03-01' }
		});
	});

	it('runs weeks from Monday through Sunday', () => {
		const week = {
			current: { start: '2026-11-23', end: '2026-11-30' },
			previous: { start: '2026-11-16', end: '2026-11-23' }
		};
		expect(reportPeriodRanges('weekly', '2026-11-23')).toEqual(week); // Monday
		expect(reportPeriodRanges('weekly', '2026-11-29')).toEqual(week); // Sunday
	});

	it('crosses year boundaries for months, quarters and years', () => {
		expect(reportPeriodRanges('monthly', '2026-01-15')).toEqual({
			current: { start: '2026-01-01', end: '2026-02-01' },
			previous: { start: '2025-12-01', end: '2026-01-01' }
		});
		expect(reportPeriodRanges('monthly', '2026-12-31').current).toEqual({
			start: '2026-12-01',
			end: '2027-01-01'
		});
		expect(reportPeriodRanges('quarterly', '2026-02-10')).toEqual({
			current: { start: '2026-01-01', end: '2026-04-01' },
			previous: { start: '2025-10-01', end: '2026-01-01' }
		});
		expect(reportPeriodRanges('quarterly', '2026-11-26').current).toEqual({
			start: '2026-10-01',
			end: '2027-01-01'
		});
		expect(reportPeriodRanges('yearly', '2026-06-01')).toEqual({
			current: { start: '2026-01-01', end: '2027-01-01' },
			previous: { start: '2025-01-01', end: '2026-01-01' }
		});
	});
});

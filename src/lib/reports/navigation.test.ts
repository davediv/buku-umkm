import { describe, expect, it } from 'vitest';
import { getLegacyReportRedirect, REPORT_DEFINITIONS } from './navigation';

describe('report navigation', () => {
	it('defines one unique canonical route per report', () => {
		const ids = REPORT_DEFINITIONS.map((report) => report.id);
		const hrefs = REPORT_DEFINITIONS.map((report) => report.href);

		expect(new Set(ids).size).toBe(REPORT_DEFINITIONS.length);
		expect(new Set(hrefs).size).toBe(REPORT_DEFINITIONS.length);
		expect(hrefs.every((href) => href.startsWith('/laporan/'))).toBe(true);
	});

	it('redirects legacy report URLs and preserves valid report state', () => {
		expect(getLegacyReportRedirect(new URLSearchParams('type=laba-rugi&period=quarterly'))).toBe(
			'/laporan/laba-rugi?period=quarterly'
		);
		expect(getLegacyReportRedirect(new URLSearchParams('type=neraca&date=2026-08-30'))).toBe(
			'/laporan/neraca?date=2026-08-30'
		);
		expect(getLegacyReportRedirect(new URLSearchParams('type=catatan&catatanPeriod=yearly'))).toBe(
			'/laporan/catatan?period=yearly'
		);
		expect(getLegacyReportRedirect(new URLSearchParams('type=spt-tahunan&sptYear=2025'))).toBe(
			'/laporan/spt-tahunan?year=2025'
		);
	});

	it('drops invalid state and safely handles the index', () => {
		expect(getLegacyReportRedirect(new URLSearchParams())).toBeNull();
		expect(getLegacyReportRedirect(new URLSearchParams('type=laba-rugi&period=forever'))).toBe(
			'/laporan/laba-rugi'
		);
		expect(getLegacyReportRedirect(new URLSearchParams('type=unknown'))).toBe('/laporan');
	});

	it('declares only exports that are actually available', () => {
		expect(REPORT_DEFINITIONS.find((report) => report.id === 'laba-rugi')?.exports).toEqual([
			'pdf'
		]);
		expect(REPORT_DEFINITIONS.find((report) => report.id === 'spt-tahunan')?.exports).toEqual([
			'pdf',
			'xlsx'
		]);
	});
});

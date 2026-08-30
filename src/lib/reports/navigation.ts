export const REPORT_IDS = ['laba-rugi', 'neraca', 'catatan', 'spt-tahunan'] as const;

export type ReportId = (typeof REPORT_IDS)[number];
export type ReportExportFormat = 'pdf' | 'xlsx';

export interface ReportDefinition {
	id: ReportId;
	label: string;
	description: string;
	href: string;
	exports: ReportExportFormat[];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
	{
		id: 'laba-rugi',
		label: 'Laba/Rugi',
		description: 'Pendapatan, beban, dan hasil usaha per periode',
		href: '/laporan/laba-rugi',
		exports: ['pdf']
	},
	{
		id: 'neraca',
		label: 'Posisi Keuangan',
		description: 'Aset, kewajiban, dan ekuitas pada tanggal tertentu',
		href: '/laporan/neraca',
		exports: ['pdf']
	},
	{
		id: 'catatan',
		label: 'Catatan',
		description: 'Kebijakan dan penjelasan pendamping laporan',
		href: '/laporan/catatan',
		exports: ['pdf']
	},
	{
		id: 'spt-tahunan',
		label: 'Draft SPT Tahunan',
		description: 'Rekap pendukung estimasi PPh Final per tahun',
		href: '/laporan/spt-tahunan',
		exports: ['pdf', 'xlsx']
	}
];

const PERIODS = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
const CATATAN_PERIODS = new Set(['monthly', 'quarterly', 'yearly']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function withQuery(pathname: string, key: string, value: string | null): string {
	if (!value) return pathname;
	return `${pathname}?${new URLSearchParams({ [key]: value }).toString()}`;
}

export function getLegacyReportRedirect(searchParams: URLSearchParams): string | null {
	const reportType = searchParams.get('type');
	if (!reportType) return null;

	switch (reportType) {
		case 'laba-rugi': {
			const period = searchParams.get('period');
			return withQuery('/laporan/laba-rugi', 'period', PERIODS.has(period ?? '') ? period : null);
		}
		case 'neraca': {
			const date = searchParams.get('date');
			return withQuery('/laporan/neraca', 'date', date && ISO_DATE.test(date) ? date : null);
		}
		case 'catatan': {
			const period = searchParams.get('catatanPeriod') ?? searchParams.get('period');
			return withQuery(
				'/laporan/catatan',
				'period',
				CATATAN_PERIODS.has(period ?? '') ? period : null
			);
		}
		case 'spt-tahunan': {
			const year = searchParams.get('year') ?? searchParams.get('sptYear');
			const numericYear = Number(year);
			return withQuery(
				'/laporan/spt-tahunan',
				'year',
				Number.isInteger(numericYear) && numericYear >= 2000 && numericYear <= 2100
					? String(numericYear)
					: null
			);
		}
		default:
			return '/laporan';
	}
}

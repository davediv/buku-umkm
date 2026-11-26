import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';
import { getIndonesianMonthName } from '$lib/tax/config';
import { reportPeriodRanges } from '$lib/server/db/queries/ledger';
import { todayInJakarta } from '$lib/shared/dates';
import { summarizeError } from '$lib/server/error-summary';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse period parameter (default: monthly)
	type PeriodType = 'monthly' | 'quarterly' | 'yearly';
	const periodParam = url.searchParams.get('period') as PeriodType | null;
	const period: PeriodType = ['monthly', 'quarterly', 'yearly'].includes(periodParam ?? '')
		? (periodParam as PeriodType)
		: 'monthly';

	try {
		// Get business profile
		const profile = await businessProfileQueries.findByUserId(db, userId);

		// Reporting period, on the Jakarta calendar like every other report
		const today = todayInJakarta();
		const [currentYear, currentMonth] = today.split('-').map(Number);
		const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1;
		const labels: Record<PeriodType, string> = {
			monthly: `${getIndonesianMonthName(currentMonth)} ${currentYear}`,
			quarterly: `Triwulan ${currentQuarter} ${currentYear}`,
			yearly: `Tahun ${currentYear}`
		};
		const getPeriodLabel = (p: PeriodType) => labels[p];
		const range = reportPeriodRanges(period, today).current;
		const startDate = range.start;
		// The range end is exclusive; the notes name the period's last day.
		const lastDay = new Date(`${range.end}T00:00:00Z`);
		lastDay.setUTCDate(lastDay.getUTCDate() - 1);
		const endDate = lastDay.toISOString().slice(0, 10);

		// Generate accounting policies in Bahasa Indonesia
		const accountingPolicies = {
			basisAccounting: 'Akuntansi Basis Akrual',
			framework: 'SAK EMKM (Standar Akuntansi Keuangan untuk Entitas Mikro Kecil Menengah)',
			currency: 'Rupiah Indonesia (IDR)',
			reportingEntity: profile?.name || 'Nama Usaha',
			period: getPeriodLabel(period),
			startDate,
			endDate,
			businessType: profile?.businessType || 'UMKM'
		};

		// Additional notes sections
		const notesSections = [
			{
				title: '1. Informasi Entitas',
				content: `Catatan ini menyajikan informasi mengenai laporan posisi keuangan dan laporan laba/rugi ${accountingPolicies.period}. Entitas ${accountingPolicies.reportingEntity} adalah usaha ${accountingPolicies.businessType} yang beroperasi di Indonesia.`
			},
			{
				title: '2. Dasar Penyusunan',
				content: `Laporan keuangan disusun berdasarkan ${accountingPolicies.framework} yang berlaku di Indonesia. Laporan ini menggunakan ${accountingPolicies.basisAccounting}: pendapatan dan beban diakui pada saat terjadinya, bukan pada saat kas diterima atau dibayarkan.`
			},
			{
				title: '3. Mata Uang Pelaporan',
				content: `Laporan keuangan disajikan dalam ${accountingPolicies.currency}. Semua transaksi dalam mata uang asing dikonversi ke Rupiah Indonesia pada tanggal transaksi.`
			},
			{
				title: '4. Kebijakan Akuntansi Penting',
				content: `Entitas menggunakan kebijakan akuntansi sebagai berikut:
- Penjualan tunai diakui sebagai pendapatan pada tanggal transaksi; penjualan kredit diakui sebagai pendapatan dan piutang usaha pada tanggal piutang dicatat
- Pembelian dan biaya tunai diakui sebagai beban pada tanggal transaksi; pembelian kredit diakui sebagai beban dan utang usaha pada tanggal utang dicatat
- Penerimaan piutang dan pembayaran utang hanya mengurangi saldo piutang atau utang, dan tidak diakui lagi sebagai pendapatan atau beban
- Pinjaman yang diberikan atau diterima dicatat sebagai piutang atau utang beserta perpindahan kasnya, dan tidak diakui sebagai pendapatan atau beban
- Transfer antar kas dan rekening milik usaha tidak memengaruhi laba/rugi
- Piutang dan utang disajikan sebesar sisa yang belum dibayar; penyisihan piutang tak tertagih dan penyusutan aset tetap belum dihitung otomatis`
			},
			{
				title: '5. Perpajakan',
				content:
					'Estimasi PPh Final UMKM hanya dapat digunakan setelah bentuk wajib pajak, periode fasilitas, pilihan rezim, dan omzet agregat diverifikasi terhadap aturan yang berlaku untuk tahun pajak terkait.'
			},
			{
				title: '6. Periode Pelaporan',
				content: `Laporan ini mencakup periode ${accountingPolicies.period}, yaitu ${startDate} sampai ${endDate}.`
			}
		];

		return {
			catatan: {
				period,
				periodLabel: getPeriodLabel(period),
				startDate,
				endDate,
				businessProfile: profile
					? {
							name: profile.name,
							address: profile.address,
							phone: profile.phone,
							npwp: profile.npwp,
							businessType: profile.businessType,
							ownerName: profile.ownerName
						}
					: null,
				accountingPolicies,
				notesSections
			}
		};
	} catch (cause) {
		console.error('Error fetching catatan data:', summarizeError(cause));
		return {
			catatan: null,
			error: 'Gagal memuat catatan atas laporan keuangan'
		};
	}
};

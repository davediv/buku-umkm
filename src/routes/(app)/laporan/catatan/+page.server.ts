import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';
import { getIndonesianMonthName } from '$lib/tax/config';

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

		// Get current date for reporting period
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1;

		// Calculate period label
		const getPeriodLabel = (p: string) => {
			const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

			const labels: Record<string, string> = {
				monthly: `${getIndonesianMonthName(currentMonth)} ${currentYear}`,
				quarterly: `Triwulan ${currentQuarter} ${currentYear}`,
				yearly: `Tahun ${currentYear}`
			};
			return labels[p] || `${getIndonesianMonthName(currentMonth)} ${currentYear}`;
		};

		// Calculate start/end dates based on period
		let startDate: string;
		let endDate: string;
		if (period === 'monthly') {
			startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
			const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
			const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
			endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
		} else if (period === 'quarterly') {
			const currentQuarter = Math.floor(now.getMonth() / 3);
			const quarterStartMonth = currentQuarter * 3 + 1;
			startDate = `${currentYear}-${String(quarterStartMonth).padStart(2, '0')}-01`;
			const quarterEndMonth = quarterStartMonth + 3;
			endDate =
				quarterEndMonth > 12
					? `${currentYear + 1}-01-01`
					: `${currentYear}-${String(quarterEndMonth).padStart(2, '0')}-01`;
		} else {
			startDate = `${currentYear}-01-01`;
			endDate = `${currentYear + 1}-01-01`;
		}

		// Generate accounting policies in Bahasa Indonesia
		const accountingPolicies = {
			basisAccounting: 'Akuntansi Basis Kas',
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
				content: `Laporan keuangan disusun berdasarkan ${accountingPolicies.framework} yang berlaku di Indonesia. Laporan ini menggunakan ${accountingPolicies.basisAccounting} dimana pendapatan dan beban diakui pada saat kas diterima atau dibayarkan.`
			},
			{
				title: '3. Mata Uang Pelaporan',
				content: `Laporan keuangan disajikan dalam ${accountingPolicies.currency}. Semua transaksi dalam mata uang asing dikonversi ke Rupiah Indonesia pada tanggal transaksi.`
			},
			{
				title: '4. Kebijakan Akuntansi Penting',
				content: `Entitas menggunakan kebijakan akuntansi sebagai berikut:
- Pendapatan diakui pada saat menerima pembayaran dari pelanggan
- Beban diakui pada saat melakukan pembayaran kepada pemasok
- Aset tetap dicatat berdasarkan harga perolehan dan disusutkan dengan metode garis lurus
- Piutang usaha disajikan setelah dikurangi penyisihan piutang tak tertagih
- Kewajiban disajikan berdasarkan jumlah yang harus dibayarkan`
			},
			{
				title: '5. Perpajakan',
				content:
					'Entitas memotong pajak penghasilan final 0,5% dari setiap transaksi pendapatan jasa sesuai dengan Peraturan Pemerintah Nomor 23 Tahun 2018 tentang Pajak Penghasilan atas Penghasilan dari Usaha yang Diterima atau Diedapatkan oleh Wajib Pajak yang Memiliki Bruto Tertentu.'
			},
			{
				title: '6. Periode Pelaporan',
				content: `Laporan ini mencakup periode pelaporan ${accountingPolicies.basisAccounting} dari ${startDate} sampai ${endDate}.`
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
	} catch {
		console.error('Error fetching catatan data:');
		return {
			catatan: null,
			error: 'Gagal memuat catatan atas laporan keuangan'
		};
	}
};

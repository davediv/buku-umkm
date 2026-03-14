import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
	dashboardQueries,
	chartOfAccountQueries,
	debtQueries,
	businessProfileQueries
} from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';
import { getIndonesianMonthName } from '$lib/tax/config';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse report type (default: laba-rugi)
	const reportType = url.searchParams.get('type') || 'laba-rugi';

	// Parse period/date based on report type
	const periodParam = url.searchParams.get('period');
	const dateParam = url.searchParams.get('date');

	// Determine period type for laporan-laba-rugi
	type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
	const period: PeriodType = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(
		periodParam ?? ''
	)
		? (periodParam as PeriodType)
		: 'monthly';

	// For neraca - date
	const selectedDate = dateParam || new Date().toISOString().split('T')[0];

	// For catatan - period
	type CatatanPeriodType = 'monthly' | 'quarterly' | 'yearly';
	const catatanPeriodParam = url.searchParams.get('catatanPeriod') as CatatanPeriodType | null;
	const catatanPeriod: CatatanPeriodType = ['monthly', 'quarterly', 'yearly'].includes(
		catatanPeriodParam ?? ''
	)
		? (catatanPeriodParam as CatatanPeriodType)
		: 'monthly';

	try {
		// Fetch only data needed for the requested report type
		let profitLossData = null;
		let balanceSheetData = null;
		let catatanData = null;

		// Common data needed for all reports
		const profile = await businessProfileQueries.findByUserId(db, userId);

		if (reportType === 'laba-rugi') {
			// Fetch profit/loss data
			const [categoryBreakdown, previousPeriod, accounts] = await Promise.all([
				dashboardQueries.getProfitLossByCategory(db, userId, period),
				dashboardQueries.getPreviousPeriodStats(db, userId, period),
				chartOfAccountQueries.findAll(db, userId)
			]);

			const currentPeriod = previousPeriod.current;
			const previousPeriodData = previousPeriod.previous;

			const totalBalance = accounts
				.filter((acc) => acc.type === 'asset')
				.reduce((sum, acc) => sum + acc.balance, 0);

			const calculatePercentChange = (current: number, previous: number): number => {
				if (previous === 0) return current > 0 ? 100 : 0;
				return ((current - previous) / previous) * 100;
			};

			const incomeChange = calculatePercentChange(currentPeriod.income, previousPeriodData.income);
			const expenseChange = calculatePercentChange(
				currentPeriod.expense,
				previousPeriodData.expense
			);
			const profitChange = calculatePercentChange(currentPeriod.profit, previousPeriodData.profit);

			const totalIncome = categoryBreakdown.income.reduce((sum, c) => sum + c.total, 0);
			const totalExpense = categoryBreakdown.expense.reduce((sum, c) => sum + c.total, 0);

			const incomeWithPercent = categoryBreakdown.income.map((c) => ({
				...c,
				percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0
			}));
			const expenseWithPercent = categoryBreakdown.expense.map((c) => ({
				...c,
				percentage: totalExpense > 0 ? (c.total / totalExpense) * 100 : 0
			}));

			const getPeriodLabel = (p: string, now: Date) => {
				const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
				const labels: Record<string, string> = {
					daily: 'Hari Ini',
					weekly: 'Minggu Ini',
					monthly: 'Bulan Ini',
					quarterly: `Q${currentQuarter} ${now.getFullYear()}`,
					yearly: 'Tahun Ini'
				};
				return labels[p] || 'Bulan Ini';
			};

			// Calculate dates for period
			const now = new Date();
			let startDate: string;
			let endDate: string;
			if (period === 'daily') {
				startDate = now.toISOString().split('T')[0];
				const tomorrow = new Date(now);
				tomorrow.setDate(tomorrow.getDate() + 1);
				endDate = tomorrow.toISOString().split('T')[0];
			} else if (period === 'weekly') {
				const dayOfWeek = now.getDay();
				const monday = new Date(now);
				monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
				startDate = monday.toISOString().split('T')[0];
				const sunday = new Date(monday);
				sunday.setDate(sunday.getDate() + 6);
				endDate = sunday.toISOString().split('T')[0];
			} else if (period === 'monthly') {
				startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
				endDate =
					now.getMonth() === 11
						? `${now.getFullYear() + 1}-01-01`
						: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;
			} else if (period === 'quarterly') {
				const currentQuarter = Math.floor(now.getMonth() / 3);
				const quarterStartMonth = currentQuarter * 3 + 1;
				const quarterEndMonth = quarterStartMonth + 3;
				startDate = `${now.getFullYear()}-${String(quarterStartMonth).padStart(2, '0')}-01`;
				endDate =
					quarterEndMonth > 12
						? `${now.getFullYear() + 1}-01-01`
						: `${now.getFullYear()}-${String(quarterEndMonth).padStart(2, '0')}-01`;
			} else {
				startDate = `${now.getFullYear()}-01-01`;
				endDate = `${now.getFullYear() + 1}-01-01`;
			}

			profitLossData = {
				period,
				periodLabel: getPeriodLabel(period, now),
				startDate,
				endDate,
				income: currentPeriod.income,
				expense: currentPeriod.expense,
				profit: currentPeriod.profit,
				totalBalance,
				comparison: {
					income: { change: incomeChange, previousValue: previousPeriodData.income },
					expense: { change: expenseChange, previousValue: previousPeriodData.expense },
					profit: { change: profitChange, previousValue: previousPeriodData.profit }
				},
				categoryBreakdown: {
					income: incomeWithPercent,
					expense: expenseWithPercent
				}
			};
		} else if (reportType === 'neraca') {
			// Fetch balance sheet data
			const [assetAccounts, piutangData, hutangData] = await Promise.all([
				chartOfAccountQueries.findByType(db, userId, 'asset'),
				debtQueries.findAll(db, userId, { type: 'piutang', status: 'active' }),
				debtQueries.findAll(db, userId, { type: 'hutang', status: 'active' })
			]);

			const totalPiutang = piutangData.reduce((sum, d) => sum + d.remainingAmount, 0);
			const totalHutang = hutangData.reduce((sum, d) => sum + d.remainingAmount, 0);

			const assetBreakdown = assetAccounts.reduce(
				(acc, a) => {
					const item = { id: a.id, name: a.name, code: a.code, balance: a.balance };
					const subtype = a.subType;

					if (subtype === 'kas') {
						acc.kas.items.push(item);
						acc.kas.subtotal += a.balance;
					} else if (subtype === 'bank') {
						acc.bank.items.push(item);
						acc.bank.subtotal += a.balance;
					} else if (subtype === 'piutang') {
						acc.piutang.items.push(item);
						acc.piutang.subtotal += a.balance;
					} else if (subtype === 'persediaan') {
						acc.persediaan.items.push(item);
						acc.persediaan.subtotal += a.balance;
					} else if (subtype === 'aktiva_tetap') {
						acc.aktivaTetap.items.push(item);
						acc.aktivaTetap.subtotal += a.balance;
					} else {
						acc.lainnya.items.push(item);
						acc.lainnya.subtotal += a.balance;
					}
					return acc;
				},
				{
					kas: {
						label: 'Kas',
						items: [] as { id: string; name: string; code: string; balance: number }[],
						subtotal: 0
					},
					bank: {
						label: 'Bank',
						items: [] as { id: string; name: string; code: string; balance: number }[],
						subtotal: 0
					},
					piutang: {
						label: 'Piutang Usaha',
						items: [] as { id: string; name: string; code: string; balance: number }[],
						subtotal: 0
					},
					persediaan: {
						label: 'Persediaan',
						items: [] as { id: string; name: string; code: string; balance: number }[],
						subtotal: 0
					},
					aktivaTetap: {
						label: 'Aktiva Tetap',
						items: [] as { id: string; name: string; code: string; balance: number }[],
						subtotal: 0
					},
					lainnya: {
						label: 'Lainnya',
						items: [] as { id: string; name: string; code: string; balance: number }[],
						subtotal: 0
					}
				}
			);

			const totalKas = assetBreakdown.kas.subtotal;
			const totalBank = assetBreakdown.bank.subtotal;
			const totalPiutangUsaha = assetBreakdown.piutang.subtotal;
			const totalPersediaan = assetBreakdown.persediaan.subtotal;
			const totalAktivaTetap = assetBreakdown.aktivaTetap.subtotal;
			const totalLainnya = assetBreakdown.lainnya.subtotal;

			const totalAssetAccounts =
				totalKas + totalBank + totalPersediaan + totalAktivaTetap + totalLainnya;
			const totalAssets = totalAssetAccounts + totalPiutang;
			const totalLiabilities = totalHutang;
			const totalEquity = totalAssets - totalLiabilities;

			const formatDate = (dateStr: string) => {
				const date = new Date(dateStr);
				return new Intl.DateTimeFormat('id-ID', {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}).format(date);
			};

			balanceSheetData = {
				date: selectedDate,
				dateLabel: formatDate(selectedDate),
				assets: {
					total: totalAssets,
					breakdown: {
						kas: {
							label: assetBreakdown.kas.label,
							items: assetBreakdown.kas.items,
							subtotal: totalKas
						},
						bank: {
							label: assetBreakdown.bank.label,
							items: assetBreakdown.bank.items,
							subtotal: totalBank
						},
						piutangUsaha: {
							label: assetBreakdown.piutang.label,
							items: assetBreakdown.piutang.items,
							subtotal: totalPiutangUsaha
						},
						piutangDetail: {
							label: 'Piutang (Detail)',
							items: piutangData.map((d) => ({
								id: d.id,
								name: d.contactName,
								originalAmount: d.originalAmount,
								paidAmount: d.paidAmount,
								remainingAmount: d.remainingAmount,
								date: d.date,
								dueDate: d.dueDate
							})),
							subtotal: totalPiutang
						},
						persediaan: {
							label: assetBreakdown.persediaan.label,
							items: assetBreakdown.persediaan.items,
							subtotal: totalPersediaan
						},
						aktivaTetap: {
							label: assetBreakdown.aktivaTetap.label,
							items: assetBreakdown.aktivaTetap.items,
							subtotal: totalAktivaTetap
						},
						lainnya: {
							label: assetBreakdown.lainnya.label,
							items: assetBreakdown.lainnya.items,
							subtotal: totalLainnya
						}
					}
				},
				liabilities: {
					total: totalLiabilities,
					breakdown: {
						hutangDetail: {
							label: 'Hutang (Detail)',
							items: hutangData.map((d) => ({
								id: d.id,
								name: d.contactName,
								originalAmount: d.originalAmount,
								paidAmount: d.paidAmount,
								remainingAmount: d.remainingAmount,
								date: d.date,
								dueDate: d.dueDate
							})),
							subtotal: totalHutang
						}
					}
				},
				equity: {
					total: totalEquity,
					components: [{ name: 'Selisih Aset dan Kewajiban', amount: totalEquity }]
				},
				isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
				equation: {
					assets: totalAssets,
					liabilities: totalLiabilities,
					equity: totalEquity,
					result: totalAssets,
					expected: totalLiabilities + totalEquity
				}
			};
		} else {
			// catatan - no additional data fetching needed, profile already fetched
			const now = new Date();
			const currentYear = now.getFullYear();
			const currentMonth = now.getMonth() + 1;

			const getCatatanPeriodLabel = (p: string, now: Date) => {
				const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
				const labels: Record<string, string> = {
					monthly: `${getIndonesianMonthName(currentMonth)} ${currentYear}`,
					quarterly: `Triwulan ${currentQuarter} ${currentYear}`,
					yearly: `Tahun ${currentYear}`
				};
				return labels[p] || `${getIndonesianMonthName(currentMonth)} ${currentYear}`;
			};

			let catatanStartDate: string;
			let catatanEndDate: string;
			if (catatanPeriod === 'monthly') {
				catatanStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
				const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
				const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
				catatanEndDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
			} else if (catatanPeriod === 'quarterly') {
				const currentQuarter = Math.floor(now.getMonth() / 3);
				const quarterStartMonth = currentQuarter * 3 + 1;
				catatanStartDate = `${currentYear}-${String(quarterStartMonth).padStart(2, '0')}-01`;
				const quarterEndMonth = quarterStartMonth + 3;
				catatanEndDate =
					quarterEndMonth > 12
						? `${currentYear + 1}-01-01`
						: `${currentYear}-${String(quarterEndMonth).padStart(2, '0')}-01`;
			} else {
				catatanStartDate = `${currentYear}-01-01`;
				catatanEndDate = `${currentYear + 1}-01-01`;
			}

			const accountingPolicies = {
				basisAccounting: 'Akuntansi Basis Kas',
				framework: 'SAK EMKM (Standar Akuntansi Keuangan untuk Entitas Mikro Kecil Menengah)',
				currency: 'Rupiah Indonesia (IDR)',
				reportingEntity: profile?.name || 'Nama Usaha',
				period: getCatatanPeriodLabel(catatanPeriod, now),
				startDate: catatanStartDate,
				endDate: catatanEndDate,
				businessType: profile?.businessType || 'UMKM'
			};

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
					content: `Laporan ini mencakup periode pelaporan ${accountingPolicies.basisAccounting} dari ${catatanStartDate} sampai ${catatanEndDate}.`
				}
			];

			catatanData = {
				period: catatanPeriod,
				periodLabel: getCatatanPeriodLabel(catatanPeriod, now),
				startDate: catatanStartDate,
				endDate: catatanEndDate,
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
			};
		}

		return {
			reportType,
			period,
			selectedDate,
			catatanPeriod,
			profitLoss: profitLossData,
			balanceSheet: balanceSheetData,
			catatan: catatanData,
			businessProfile: profile
				? {
						name: profile.name,
						address: profile.address,
						npwp: profile.npwp,
						ownerName: profile.ownerName
					}
				: null
		};
	} catch (error) {
		console.error('Error fetching laporan data:', error);
		return {
			reportType,
			period,
			selectedDate,
			catatanPeriod,
			profitLoss: null,
			balanceSheet: null,
			catatan: null,
			error: 'Gagal memuat data laporan'
		};
	}
};

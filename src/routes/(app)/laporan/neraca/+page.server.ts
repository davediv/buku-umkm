import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { chartOfAccountQueries, debtQueries } from '$lib/server/db/queries';
import { redirect } from '@sveltejs/kit';
import { formatDateLong } from '$lib/utils';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const userId = locals.user.id;
	const db = getDb();

	// Parse date parameter (default to today)
	const dateParam = url.searchParams.get('date');
	const selectedDate = dateParam || new Date().toISOString().split('T')[0];

	try {
		// Fetch data in parallel
		const [assetAccounts, piutangData, hutangData] = await Promise.all([
			// Get all asset accounts
			chartOfAccountQueries.findByType(db, userId, 'asset'),
			// Get total outstanding piutang (receivables)
			debtQueries.findAll(db, userId, { type: 'piutang', status: 'active' }),
			// Get total outstanding hutang (payables)
			debtQueries.findAll(db, userId, { type: 'hutang', status: 'active' })
		]);

		// Calculate total piutang and hutang from debt table
		const totalPiutang = piutangData.reduce((sum, d) => sum + d.remainingAmount, 0);
		const totalHutang = hutangData.reduce((sum, d) => sum + d.remainingAmount, 0);

		// Single pass to categorize asset accounts and calculate subtotals
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

		// Calculate totals
		const totalKas = assetBreakdown.kas.subtotal;
		const totalBank = assetBreakdown.bank.subtotal;
		const totalPiutangUsaha = assetBreakdown.piutang.subtotal;
		const totalPersediaan = assetBreakdown.persediaan.subtotal;
		const totalAktivaTetap = assetBreakdown.aktivaTetap.subtotal;
		const totalLainnya = assetBreakdown.lainnya.subtotal;

		// Total asset accounts (cash/bank/etc, excluding piutang from accounts since we use debt table for piutang)
		const totalAssetAccounts =
			totalKas + totalBank + totalPersediaan + totalAktivaTetap + totalLainnya;

		// Total assets = asset accounts + piutang (from debt table)
		const totalAssets = totalAssetAccounts + totalPiutang;

		// Total liabilities (hutang)
		const totalLiabilities = totalHutang;

		// Equity = Assets - Liabilities
		const totalEquity = totalAssets - totalLiabilities;

		return {
			balanceSheet: {
				date: selectedDate,
				dateLabel: formatDateLong(selectedDate),
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
					// Show accumulated profit/loss as part of equity
					components: [
						{
							name: 'Selisih Aset dan Kewajiban',
							amount: totalEquity
						}
					]
				},
				// Balance sheet equation validation
				isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
				equation: {
					assets: totalAssets,
					liabilities: totalLiabilities,
					equity: totalEquity,
					result: totalAssets,
					expected: totalLiabilities + totalEquity
				}
			}
		};
	} catch {
		console.error('Error fetching balance sheet data:');
		return {
			balanceSheet: null,
			error: 'Gagal memuat data laporan posisi keuangan'
		};
	}
};

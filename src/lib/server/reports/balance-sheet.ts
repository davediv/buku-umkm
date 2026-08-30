import { and, eq, lte } from 'drizzle-orm';
import type { SQLiteDb } from '$lib/server/db';
import { dateFromTimestamp } from '$lib/shared/dates';
import { formatDateLong } from '$lib/utils';

export type HistoricalAccount = {
	id: string;
	name: string;
	code: string;
	type: string;
	subType: string | null;
	isActive: boolean;
	openingBalance: number;
	openingDate: string | null;
	createdAt: Date | number | string;
};

export type HistoricalTransaction = {
	accountId: string;
	date: string;
	type: string;
	amount: number;
	debtId: string | null;
	toAccountId: string | null;
};

export type HistoricalDebt = {
	id: string;
	type: string;
	contactName: string;
	originalAmount: number;
	date: string;
	dueDate: string | null;
	isActive: boolean;
	payments: Array<{ amount: number; date: string }>;
};

type AssetItem = { id: string; name: string; code: string; balance: number };
type AssetGroup = { label: string; items: AssetItem[]; subtotal: number };
type DebtItem = {
	id: string;
	name: string;
	originalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	date: string;
	dueDate: string | null;
};

function movementEffect(item: HistoricalTransaction): number {
	if (item.type === 'income') return item.amount;
	if (item.type === 'expense') return -item.amount;
	return 0;
}

function emptyAssetGroup(label: string): AssetGroup {
	return { label, items: [], subtotal: 0 };
}

function debtAsOf(item: HistoricalDebt, selectedDate: string): DebtItem | null {
	if (!item.isActive || item.date > selectedDate) return null;
	const paidAmount = item.payments
		.filter((payment) => payment.date <= selectedDate)
		.reduce((sum, payment) => sum + payment.amount, 0);
	const remainingAmount = Math.max(0, item.originalAmount - paidAmount);
	if (remainingAmount === 0) return null;

	return {
		id: item.id,
		name: item.contactName,
		originalAmount: item.originalAmount,
		paidAmount,
		remainingAmount,
		date: item.date,
		dueDate: item.dueDate
	};
}

export function calculateBalanceSheetAsOf(
	selectedDate: string,
	accounts: HistoricalAccount[],
	transactions: HistoricalTransaction[],
	debts: HistoricalDebt[]
) {
	const assetAccounts = accounts.filter((account) => account.isActive && account.type === 'asset');
	const assetAccountIds = new Set(assetAccounts.map((account) => account.id));
	const movements = transactions.filter(
		(item) => item.date <= selectedDate && assetAccountIds.has(item.accountId)
	);
	const groups = {
		kas: emptyAssetGroup('Kas'),
		bank: emptyAssetGroup('Bank'),
		piutang: emptyAssetGroup('Piutang Usaha'),
		persediaan: emptyAssetGroup('Persediaan'),
		aktivaTetap: emptyAssetGroup('Aktiva Tetap'),
		lainnya: emptyAssetGroup('Lainnya')
	};

	let openingCapital = 0;
	for (const account of assetAccounts) {
		const openingDate = account.openingDate ?? dateFromTimestamp(account.createdAt);
		const openingBalance = openingDate <= selectedDate ? account.openingBalance : 0;
		openingCapital += openingBalance;
		const balance = movements
			.filter((item) => item.accountId === account.id)
			.reduce((sum, item) => sum + movementEffect(item), openingBalance);
		const assetItem = { id: account.id, name: account.name, code: account.code, balance };

		if (account.subType === 'kas') groups.kas.items.push(assetItem);
		else if (account.subType === 'bank') groups.bank.items.push(assetItem);
		else if (account.subType === 'piutang') groups.piutang.items.push(assetItem);
		else if (account.subType === 'persediaan') groups.persediaan.items.push(assetItem);
		else if (account.subType === 'aktiva_tetap') groups.aktivaTetap.items.push(assetItem);
		else groups.lainnya.items.push(assetItem);
	}

	for (const group of Object.values(groups)) {
		group.subtotal = group.items.reduce((sum, item) => sum + item.balance, 0);
	}

	const piutangItems = debts
		.filter((item) => item.type === 'piutang')
		.map((item) => debtAsOf(item, selectedDate))
		.filter((item): item is DebtItem => item !== null);
	const hutangItems = debts
		.filter((item) => item.type === 'hutang')
		.map((item) => debtAsOf(item, selectedDate))
		.filter((item): item is DebtItem => item !== null);
	const totalPiutang = piutangItems.reduce((sum, item) => sum + item.remainingAmount, 0);
	const totalHutang = hutangItems.reduce((sum, item) => sum + item.remainingAmount, 0);
	const totalAccountAssets = Object.values(groups).reduce((sum, group) => sum + group.subtotal, 0);
	const totalAssets = totalAccountAssets + totalPiutang;

	// Linked debt payments and transfers only move value between balance-sheet
	// accounts. Excluding them here prevents counting them again as profit/loss.
	const accumulatedOperatingResult = movements
		.filter((item) => !item.debtId && !item.toAccountId)
		.reduce((sum, item) => sum + movementEffect(item), 0);
	const debtRecognition = debts
		.filter((item) => item.isActive && item.date <= selectedDate)
		.reduce((sum, item) => {
			if (item.type === 'piutang') return sum + item.originalAmount;
			if (item.type === 'hutang') return sum - item.originalAmount;
			return sum;
		}, 0);
	const totalEquity = openingCapital + accumulatedOperatingResult + debtRecognition;
	const expected = totalHutang + totalEquity;

	return {
		date: selectedDate,
		dateLabel: formatDateLong(selectedDate),
		methodology:
			'Saldo dihitung dari saldo awal dan seluruh pergerakan bertanggal sampai tanggal laporan.',
		assets: {
			total: totalAssets,
			breakdown: {
				kas: groups.kas,
				bank: groups.bank,
				piutangUsaha: groups.piutang,
				piutangDetail: {
					label: 'Piutang (Detail)',
					items: piutangItems,
					subtotal: totalPiutang
				},
				persediaan: groups.persediaan,
				aktivaTetap: groups.aktivaTetap,
				lainnya: groups.lainnya
			}
		},
		liabilities: {
			total: totalHutang,
			breakdown: {
				hutangDetail: {
					label: 'Hutang (Detail)',
					items: hutangItems,
					subtotal: totalHutang
				}
			}
		},
		equity: {
			total: totalEquity,
			components: [
				{ name: 'Modal dari saldo awal', amount: openingCapital },
				{ name: 'Akumulasi hasil usaha', amount: accumulatedOperatingResult },
				{ name: 'Dampak pengakuan hutang/piutang', amount: debtRecognition }
			]
		},
		isBalanced: totalAssets === expected,
		equation: {
			assets: totalAssets,
			liabilities: totalHutang,
			equity: totalEquity,
			result: totalAssets,
			expected
		}
	};
}

export async function getBalanceSheetAsOf(db: SQLiteDb, userId: string, selectedDate: string) {
	const [accounts, transactions, debts] = await Promise.all([
		db.query.chartOfAccount.findMany({
			where: (account, { eq, and }) => and(eq(account.userId, userId), eq(account.type, 'asset')),
			orderBy: (account, { asc }) => [asc(account.code)]
		}),
		db.query.transaction.findMany({
			where: (item) =>
				and(eq(item.userId, userId), eq(item.isActive, true), lte(item.date, selectedDate)),
			columns: {
				accountId: true,
				date: true,
				type: true,
				amount: true,
				debtId: true,
				toAccountId: true
			}
		}),
		db.query.debt.findMany({
			where: (item) =>
				and(eq(item.userId, userId), eq(item.isActive, true), lte(item.date, selectedDate)),
			with: {
				payments: {
					where: (payment) => lte(payment.date, selectedDate),
					orderBy: (payment, { asc }) => [asc(payment.date)]
				}
			}
		})
	]);

	return calculateBalanceSheetAsOf(selectedDate, accounts, transactions, debts);
}

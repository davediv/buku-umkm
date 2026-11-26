/*
 * Interest on a loan. A loan payment can carry interest next to its principal: the
 * principal only moves cash (it is linked to the debt), while the interest is its own
 * transaction without a debt link, so it counts in the income statement: an expense on
 * a loan received (hutang), income on a loan given (piutang).
 *
 * Interest income is not turnover for PPh Final 0,5%: see loanInterestRows() in
 * $lib/server/db/queries/ledger.
 */

export type InterestType = 'income' | 'expense';

/**
 * The system category each side of loan interest is booked under. It is created for a
 * user the first time they record that side, and found again by code, type and isSystem.
 * Codes follow SAK EMKM as the category rules do: 4xxx income, 7xxx other expenses.
 */
export const LOAN_INTEREST_CATEGORIES = {
	expense: { code: '7101', name: 'Beban Bunga', icon: 'Percent', color: '#f97316' },
	income: { code: '4901', name: 'Pendapatan Bunga', icon: 'Percent', color: '#0d9488' }
} as const satisfies Record<
	InterestType,
	{ code: string; name: string; icon: string; color: string }
>;

/** Codes kept for the loan interest categories, never handed out to a new category. */
export const LOAN_INTEREST_CATEGORY_CODES: ReadonlySet<string> = new Set(
	Object.values(LOAN_INTEREST_CATEGORIES).map((item) => item.code)
);

/** The interest transaction's description, matching the principal payment's wording. */
export function loanInterestDescription(debtType: string, contactName: string): string {
	return debtType === 'piutang'
		? `Bunga pinjaman dari ${contactName}`
		: `Bunga pinjaman ke ${contactName}`;
}

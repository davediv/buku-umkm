/** What the transaction list and exports need to name a row. */
export type LabelledTransaction = {
	type: string;
	toAccountId?: string | null;
	debtId?: string | null;
	category?: { name: string } | null;
};

/** One leg of a transfer between the user's own accounts (stored as two linked rows). */
export function isTransferLeg(transaction: LabelledTransaction): boolean {
	return Boolean(transaction.toAccountId) || transaction.type === 'transfer';
}

/**
 * A cash movement linked to a debt: a payment, or a loan's principal. It changes a balance
 * but is not income or expense on the accrual basis.
 */
export function isDebtCashMovement(transaction: LabelledTransaction): boolean {
	return Boolean(transaction.debtId) && !isTransferLeg(transaction);
}

/** The row's kind for lists and exports ("Jenis"). */
export function transactionKindLabel(transaction: LabelledTransaction): string {
	if (isTransferLeg(transaction)) return 'Transfer';
	if (isDebtCashMovement(transaction)) {
		return transaction.type === 'income'
			? 'Kas masuk (utang/piutang)'
			: 'Kas keluar (utang/piutang)';
	}
	return transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
}

/** The row's category, or what stands in for one on transfers and debt movements. */
export function transactionCategoryLabel(
	transaction: LabelledTransaction,
	fallback = 'Tanpa kategori'
): string {
	if (transaction.category?.name) return transaction.category.name;
	if (isTransferLeg(transaction)) return 'Transfer';
	if (isDebtCashMovement(transaction)) return 'Utang & piutang';
	return fallback;
}

export type TransactionFormValues = {
	amount: string;
	accountId: string;
	date: string;
};

export type TransactionFormValidation =
	| { valid: true; amount: number }
	| { valid: false; message: string };

export function validateTransactionForm(values: TransactionFormValues): TransactionFormValidation {
	const amount = Number.parseInt(values.amount.replace(/\D/g, ''), 10);
	if (!amount || amount <= 0) {
		return { valid: false, message: 'Jumlah harus lebih dari 0' };
	}
	if (!values.accountId) {
		return { valid: false, message: 'Pilih kas atau rekening terlebih dahulu' };
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
		return { valid: false, message: 'Tanggal transaksi wajib diisi' };
	}
	return { valid: true, amount };
}

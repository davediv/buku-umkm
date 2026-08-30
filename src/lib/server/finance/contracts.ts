import { MAX_TRANSACTION_AMOUNT } from '$lib/constants';

export class FinanceError extends Error {
	constructor(
		message: string,
		public readonly status = 400,
		public readonly code = 'INVALID_COMMAND'
	) {
		super(message);
		this.name = 'FinanceError';
	}
}

export type TransactionType = 'income' | 'expense';
export type DebtType = 'piutang' | 'hutang';

export type CreateTransactionCommand = {
	type: TransactionType;
	amount: number;
	accountId: string;
	categoryId: string | null;
	date: string;
	description: string | null;
};

export type UpdateTransactionCommand = {
	amount?: number;
	categoryId?: string | null;
	date?: string;
	description?: string | null;
	referenceNumber?: string | null;
	notes?: string | null;
};

export type CreateTransferCommand = {
	amount: number;
	sourceAccountId: string;
	destinationAccountId: string;
	date: string;
	description: string | null;
};

export type CreateDebtCommand = {
	type: DebtType;
	contactName: string;
	contactPhone: string | null;
	contactAddress: string | null;
	originalAmount: number;
	date: string;
	dueDate: string | null;
	description: string | null;
};

export type UpdateDebtCommand = {
	contactName?: string;
	contactPhone?: string | null;
	contactAddress?: string | null;
	dueDate?: string | null;
	description?: string | null;
};

export type RecordDebtPaymentCommand = {
	amount: number;
	date: string;
	accountId: string;
	notes: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new FinanceError('Format permintaan tidak valid');
	}
	return value as Record<string, unknown>;
}

function requiredString(
	value: unknown,
	label: string,
	maxLength: number,
	fieldCode = 'INVALID_FIELD'
): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new FinanceError(`${label} wajib diisi`, 400, fieldCode);
	}
	const normalized = value.trim();
	if (normalized.length > maxLength) {
		throw new FinanceError(`${label} maksimal ${maxLength} karakter`, 400, fieldCode);
	}
	return normalized;
}

function optionalString(value: unknown, label: string, maxLength: number): string | null {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'string') throw new FinanceError(`${label} tidak valid`);
	const normalized = value.trim();
	if (normalized.length > maxLength) {
		throw new FinanceError(`${label} maksimal ${maxLength} karakter`);
	}
	return normalized || null;
}

function money(value: unknown, label = 'Jumlah'): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new FinanceError(`${label} harus berupa Rupiah bulat dan lebih dari 0`);
	}
	if (parsed > MAX_TRANSACTION_AMOUNT) {
		throw new FinanceError(`${label} maksimal Rp${MAX_TRANSACTION_AMOUNT.toLocaleString('id-ID')}`);
	}
	return parsed;
}

function jakartaToday(): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
}

function date(value: unknown, label: string, allowFuture = false): string {
	const normalized = requiredString(value, label, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new FinanceError(`Format ${label.toLowerCase()} harus YYYY-MM-DD`);
	}
	const parsed = new Date(`${normalized}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
		throw new FinanceError(`${label} tidak valid`);
	}
	if (!allowFuture && normalized > jakartaToday()) {
		throw new FinanceError(`${label} tidak boleh di masa depan`);
	}
	return normalized;
}

export function requireIdempotencyKey(request: Request): string {
	const key = request.headers.get('Idempotency-Key')?.trim() ?? '';
	if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
		throw new FinanceError(
			'Idempotency-Key wajib diisi dengan 8–128 karakter yang valid',
			400,
			'INVALID_IDEMPOTENCY_KEY'
		);
	}
	return key;
}

export function parseCreateTransaction(value: unknown): CreateTransactionCommand {
	const body = asObject(value);
	if (body.type !== 'income' && body.type !== 'expense') {
		throw new FinanceError('Jenis transaksi wajib dipilih (income/expense)');
	}

	return {
		type: body.type,
		amount: money(body.amount),
		accountId: requiredString(body.account_id, 'Akun', 100),
		categoryId: optionalString(body.category_id, 'Kategori', 100),
		date: date(body.date, 'Tanggal'),
		description: optionalString(body.description, 'Keterangan', 500)
	};
}

export function parseUpdateTransaction(value: unknown): UpdateTransactionCommand {
	const body = asObject(value);
	if ('type' in body || 'account_id' in body) {
		throw new FinanceError('Jenis dan akun transaksi tidak dapat diubah setelah disimpan');
	}

	const command: UpdateTransactionCommand = {};
	if ('amount' in body) command.amount = money(body.amount);
	if ('category_id' in body) command.categoryId = optionalString(body.category_id, 'Kategori', 100);
	if ('date' in body) command.date = date(body.date, 'Tanggal');
	if ('description' in body) {
		command.description = optionalString(body.description, 'Keterangan', 500);
	}
	if ('reference_number' in body) {
		command.referenceNumber = optionalString(body.reference_number, 'Nomor referensi', 100);
	}
	if ('notes' in body) command.notes = optionalString(body.notes, 'Catatan', 1000);
	return command;
}

export function parseCreateTransfer(value: unknown): CreateTransferCommand {
	const body = asObject(value);
	const sourceAccountId = requiredString(body.source_account_id, 'Akun sumber', 100);
	const destinationAccountId = requiredString(body.destination_account_id, 'Akun tujuan', 100);
	if (sourceAccountId === destinationAccountId) {
		throw new FinanceError('Akun sumber dan tujuan tidak boleh sama');
	}

	return {
		amount: money(body.amount),
		sourceAccountId,
		destinationAccountId,
		date: date(body.date, 'Tanggal'),
		description: optionalString(body.description, 'Keterangan', 500)
	};
}

export function parseCreateDebt(value: unknown): CreateDebtCommand {
	const body = asObject(value);
	if (body.type !== 'piutang' && body.type !== 'hutang') {
		throw new FinanceError('Tipe wajib dipilih (piutang/hutang)');
	}
	const debtDate = date(body.date, 'Tanggal');
	const dueDate = body.due_date ? date(body.due_date, 'Tanggal jatuh tempo', true) : null;
	if (dueDate && dueDate < debtDate) {
		throw new FinanceError('Tanggal jatuh tempo tidak boleh sebelum tanggal pencatatan');
	}

	return {
		type: body.type,
		contactName: requiredString(body.contact_name, 'Nama kontak', 200),
		contactPhone: optionalString(body.contact_phone, 'Nomor telepon', 20),
		contactAddress: optionalString(body.contact_address, 'Alamat', 500),
		originalAmount: money(body.amount),
		date: debtDate,
		dueDate,
		description: optionalString(body.description, 'Keterangan', 500)
	};
}

export function parseUpdateDebt(value: unknown): UpdateDebtCommand {
	const body = asObject(value);
	const command: UpdateDebtCommand = {};
	if ('contact_name' in body) {
		command.contactName = requiredString(body.contact_name, 'Nama kontak', 200);
	}
	if ('contact_phone' in body) {
		command.contactPhone = optionalString(body.contact_phone, 'Nomor telepon', 20);
	}
	if ('contact_address' in body) {
		command.contactAddress = optionalString(body.contact_address, 'Alamat', 500);
	}
	if ('due_date' in body) {
		command.dueDate = body.due_date ? date(body.due_date, 'Tanggal jatuh tempo', true) : null;
	}
	if ('description' in body) {
		command.description = optionalString(body.description, 'Keterangan', 500);
	}
	return command;
}

export function parseDebtPayment(value: unknown): RecordDebtPaymentCommand {
	const body = asObject(value);
	return {
		amount: money(body.amount, 'Jumlah pembayaran'),
		date: date(body.date, 'Tanggal'),
		accountId: requiredString(body.account_id, 'Akun', 100),
		notes: optionalString(body.notes, 'Catatan', 1000)
	};
}

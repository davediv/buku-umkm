import { BUSINESS_TYPES, MAX_TRANSACTION_AMOUNT } from '$lib/constants';
import type {
	businessProfile,
	category,
	chartOfAccount,
	debt,
	debtPayment,
	onboardingState,
	taxProfile,
	taxRecord,
	transaction,
	transactionTemplate
} from '$lib/server/db/schema';
import { sanitizePhotoFileName } from '$lib/server/photos/receipts';
import { isIsoCalendarDate, todayInJakarta } from '$lib/shared/dates';
import {
	isCategoryType,
	validateCategoryCode,
	validateCategoryColor,
	validateCategoryIcon,
	validateCategoryName,
	validateTemplateDescription,
	validateTemplateName,
	type FieldResult
} from '$lib/shared/validation/category';
import { TAX_LEGAL_FORM, TAX_REGIME_CHOICE, TAX_STATUS, TAX_TYPE } from '$lib/tax/config';
import { BACKUP_FORMAT, MAX_RESTORE_ROWS, SUPPORTED_BACKUP_MAJOR_VERSIONS } from './format';

/** A backup the server refuses to restore; the message is shown to the user as is. */
export class BackupError extends Error {
	constructor(
		message: string,
		public readonly status = 400,
		public readonly code = 'INVALID_BACKUP'
	) {
		super(message);
		this.name = 'BackupError';
	}
}

type NewBusinessProfile = typeof businessProfile.$inferInsert;
type NewOnboardingState = typeof onboardingState.$inferInsert;
type NewAccount = typeof chartOfAccount.$inferInsert;
type NewCategory = typeof category.$inferInsert;
type NewTransaction = typeof transaction.$inferInsert;
type NewDebt = typeof debt.$inferInsert;
type NewPayment = typeof debtPayment.$inferInsert;
type NewTaxProfile = typeof taxProfile.$inferInsert;
type NewTaxRecord = typeof taxRecord.$inferInsert;
type NewTemplate = typeof transactionTemplate.$inferInsert;

/** A photo row that is kept only if its image is found in the caller's R2 prefix. */
export type PhotoCandidate = {
	id: string;
	transactionId: string;
	/** The key the file claims; never stored unless R2 confirms it (see restore.ts). */
	claimedKey: string;
	fileName: string;
	caption: string | null;
	createdAt: Date;
};

/**
 * Everything a backup restores, owned by the caller, with fresh ids and every link
 * rewritten to those ids. Nothing in it points outside the file.
 */
export type RestorePlan = {
	schemaVersion: string;
	businessProfile: NewBusinessProfile | null;
	/** Absent from 1.x backups. */
	onboardingState: NewOnboardingState | null;
	accounts: NewAccount[];
	categories: NewCategory[];
	/** With principalTransactionId; restore inserts them without it, then links them. */
	debts: NewDebt[];
	transactions: NewTransaction[];
	payments: NewPayment[];
	taxProfiles: NewTaxProfile[];
	taxRecords: NewTaxRecord[];
	templates: NewTemplate[];
	photoCandidates: PhotoCandidate[];
	/** Photo rows dropped while reading the file (their transaction is not in a 1.x file). */
	photosWithoutTransaction: number;
};

type Row = Record<string, unknown>;
type IdMap = Map<string, string>;

const MAX_ID_LENGTH = 128;
const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
const BUSINESS_TYPE_VALUES = BUSINESS_TYPES.map((item) => item.value);
const LEGAL_FORMS = Object.values(TAX_LEGAL_FORM);
const REGIME_CHOICES = Object.values(TAX_REGIME_CHOICE);
const TAX_TYPES = Object.values(TAX_TYPE);
const TAX_STATUSES = Object.values(TAX_STATUS);

function isRow(value: unknown): value is Row {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Reads one record's fields, naming the record in every error it raises. */
class RecordReader {
	constructor(
		private readonly where: string,
		private readonly row: Row
	) {}

	fail(problem: string): never {
		throw new BackupError(`Data ${this.where} tidak valid: ${problem}.`);
	}

	check<T>(result: FieldResult<T>): T {
		if (!result.ok) this.fail(result.error);
		return result.value;
	}

	has(key: string): boolean {
		return this.row[key] !== undefined && this.row[key] !== null;
	}

	id(): string {
		const value = this.row.id;
		if (typeof value !== 'string' || !value || value.length > MAX_ID_LENGTH) {
			this.fail('ID tidak valid');
		}
		return value;
	}

	text(key: string, label: string, maxLength: number): string | null {
		const value = this.row[key];
		if (value === undefined || value === null) return null;
		if (typeof value !== 'string') this.fail(`${label} harus berupa teks`);
		const normalized = value.trim();
		if (normalized.length > maxLength) this.fail(`${label} maksimal ${maxLength} karakter`);
		return normalized || null;
	}

	requiredText(key: string, label: string, maxLength: number): string {
		const value = this.text(key, label, maxLength);
		if (!value) this.fail(`${label} wajib diisi`);
		return value;
	}

	flag(key: string, fallback: boolean): boolean {
		const value = this.row[key];
		if (value === undefined || value === null) return fallback;
		if (typeof value === 'boolean') return value;
		if (value === 0 || value === 1) return value === 1;
		this.fail(`kolom ${key} harus bernilai true atau false`);
	}

	/** A yes/no answer that may not have been given yet (null). */
	optionalFlag(key: string): boolean | null {
		return this.has(key) ? this.flag(key, false) : null;
	}

	choice<T extends string>(key: string, label: string, values: readonly T[], fallback?: T): T {
		const value = this.row[key];
		if ((value === undefined || value === null) && fallback !== undefined) return fallback;
		if (typeof value !== 'string' || !values.includes(value as T)) {
			this.fail(`${label} tidak dikenali`);
		}
		return value as T;
	}

	integer(key: string, label: string, min: number, max: number, fallback?: number): number {
		const value = this.row[key];
		if ((value === undefined || value === null) && fallback !== undefined) return fallback;
		if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
			this.fail(`${label} harus berupa bilangan bulat antara ${min} dan ${max}`);
		}
		return value;
	}

	/** Whole Rupiah above zero, as a transaction amount (finance/contracts.ts money()). */
	money(key: string, label: string): number {
		const value = this.row[key];
		if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
			this.fail(`${label} harus berupa Rupiah bulat dan lebih dari 0`);
		}
		if (value > MAX_TRANSACTION_AMOUNT) {
			this.fail(`${label} maksimal Rp${MAX_TRANSACTION_AMOUNT.toLocaleString('id-ID')}`);
		}
		return value;
	}

	/** Whole Rupiah from zero up, such as an amount already paid. */
	rupiah(key: string, label: string, fallback?: number): number {
		return this.integer(key, label, 0, Number.MAX_SAFE_INTEGER, fallback);
	}

	/** A running balance, which an expense larger than the money held makes negative. */
	balance(key: string, label: string, fallback?: number): number {
		return this.integer(key, label, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, fallback);
	}

	date(key: string, label: string): string {
		const value = this.optionalDate(key, label);
		if (!value) this.fail(`${label} wajib diisi`);
		return value;
	}

	optionalDate(key: string, label: string): string | null {
		const value = this.row[key];
		if (value === undefined || value === null || value === '') return null;
		if (typeof value !== 'string' || !isIsoCalendarDate(value)) {
			this.fail(`${label} harus berupa tanggal YYYY-MM-DD yang valid`);
		}
		return value;
	}

	/** createdAt/updatedAt as written by the backup (ISO text); missing means now. */
	timestamp(key: string): Date {
		return this.optionalTimestamp(key) ?? new Date();
	}

	optionalTimestamp(key: string): Date | null {
		const value = this.row[key];
		if (value === undefined || value === null) return null;
		const parsed = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
		if (!parsed || Number.isNaN(parsed.getTime())) this.fail(`waktu ${key} tidak valid`);
		return parsed;
	}

	/**
	 * A link to another row of the file, rewritten to that row's new id. A link to
	 * anything not in the file (another user's row, a deleted row) rejects the backup.
	 */
	ref(key: string, ids: IdMap, target: string): string | null {
		const value = this.row[key];
		if (value === undefined || value === null || value === '') return null;
		const mapped = typeof value === 'string' ? ids.get(value) : undefined;
		if (!mapped) this.fail(`${target} yang dirujuk (${key}) tidak ada di file backup`);
		return mapped;
	}

	requiredRef(key: string, ids: IdMap, target: string): string {
		const mapped = this.ref(key, ids, target);
		if (!mapped) this.fail(`${target} (${key}) wajib diisi`);
		return mapped;
	}

	raw(key: string): unknown {
		return this.row[key];
	}
}

function readers(document: Row, key: string, label: string, required: boolean): RecordReader[] {
	const value = document[key];
	if (value === undefined && !required) return [];
	if (!Array.isArray(value)) {
		throw new BackupError(`File backup tidak valid: daftar ${label} (${key}) tidak ditemukan.`);
	}
	return value.map((item, index) => {
		const where = `${label} ke-${index + 1}`;
		if (!isRow(item)) throw new BackupError(`Data ${where} tidak valid: bukan sebuah objek.`);
		return new RecordReader(where, item);
	});
}

/** Gives every row of a table a fresh id, keyed by the id the file used. */
function freshIds(rows: RecordReader[]): IdMap {
	const ids: IdMap = new Map();
	for (const row of rows) {
		const id = row.id();
		if (ids.has(id)) row.fail('ID yang sama dipakai oleh lebih dari satu baris');
		ids.set(id, crypto.randomUUID());
	}
	return ids;
}

function readVersion(document: Row): { text: string; major: number } {
	const text = document.schemaVersion;
	const match = typeof text === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/.exec(text) : null;
	if (!match)
		throw new BackupError('File ini bukan backup Buku UMKM: versi backup tidak ditemukan.');
	const major = Number(match[1]);
	if (!(SUPPORTED_BACKUP_MAJOR_VERSIONS as readonly number[]).includes(major)) {
		throw new BackupError(`Versi backup ${text} tidak didukung oleh aplikasi ini.`);
	}
	if (major >= 2 && document.format !== BACKUP_FORMAT) {
		throw new BackupError('File ini bukan backup Buku UMKM.');
	}
	return { text: text as string, major };
}

function readBusinessProfile(rows: RecordReader[], userId: string): NewBusinessProfile | null {
	if (rows.length > 1) {
		throw new BackupError('File backup tidak valid: berisi lebih dari satu profil usaha.');
	}
	const [row] = rows;
	if (!row) return null;
	return {
		id: crypto.randomUUID(),
		userId,
		name: row.requiredText('name', 'Nama usaha', 200),
		address: row.text('address', 'Alamat', 500),
		phone: row.text('phone', 'Nomor telepon', 20),
		// Still encrypted: restore.ts keeps it only if this deployment can decrypt it.
		npwp: row.text('npwp', 'NPWP', 500),
		businessType: row.choice('businessType', 'Jenis usaha', BUSINESS_TYPE_VALUES),
		ownerName: row.text('ownerName', 'Nama pemilik', 200),
		industry: row.text('industry', 'Bidang usaha', 100),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

function readOnboardingState(document: Row, userId: string): NewOnboardingState | null {
	const value = document.onboardingState;
	if (value === undefined || value === null) return null;
	if (!isRow(value)) {
		throw new BackupError('Data status onboarding tidak valid: bukan sebuah objek.');
	}
	const row = new RecordReader('status onboarding', value);
	return {
		userId,
		status: row.choice('status', 'Status', ['completed', 'skipped'] as const),
		completedAt: row.optionalTimestamp('completedAt'),
		skippedAt: row.optionalTimestamp('skippedAt'),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

function readCategory(row: RecordReader, id: string, userId: string): NewCategory {
	const type = row.raw('type');
	if (!isCategoryType(type)) row.fail('Tipe kategori harus income atau expense');
	const code = row.check(validateCategoryCode(row.raw('code'), type));
	if (!code) row.fail('Kode kategori wajib diisi');
	// Icon and colour are display-only, and rows saved before they were validated may hold
	// anything; an unknown value is dropped (the UI shows its default) rather than refused.
	const icon = validateCategoryIcon(row.raw('icon'));
	const color = validateCategoryColor(row.raw('color'));
	return {
		id,
		userId,
		code,
		name: row.check(validateCategoryName(row.raw('name'))),
		type,
		isSystem: row.flag('isSystem', false),
		isActive: row.flag('isActive', true),
		icon: icon.ok ? (icon.value ?? null) : null,
		color: color.ok ? (color.value ?? null) : null,
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

function readTransaction(
	row: RecordReader,
	id: string,
	userId: string,
	ids: { accounts: IdMap; categories: IdMap; debts: IdMap }
): NewTransaction {
	const accountId = row.requiredRef('accountId', ids.accounts, 'Akun');
	const toAccountId = row.ref('toAccountId', ids.accounts, 'Akun tujuan transfer');
	if (toAccountId === accountId) row.fail('Akun sumber dan tujuan transfer tidak boleh sama');
	return {
		id,
		userId,
		date: row.date('date', 'Tanggal'),
		type: row.choice('type', 'Jenis transaksi', ['income', 'expense'] as const),
		amount: row.money('amount', 'Jumlah'),
		description: row.text('description', 'Keterangan', 500),
		accountId,
		toAccountId,
		categoryId: row.ref('categoryId', ids.categories, 'Kategori'),
		debtId: row.ref('debtId', ids.debts, 'Hutang/piutang'),
		isTaxed: row.flag('isTaxed', false),
		taxAmount: row.rupiah('taxAmount', 'Jumlah pajak', 0),
		referenceNumber: row.text('referenceNumber', 'Nomor referensi', 100),
		notes: row.text('notes', 'Catatan', 1000),
		isActive: row.flag('isActive', true),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

function readDebt(
	row: RecordReader,
	id: string,
	userId: string,
	ids: { accounts: IdMap; transactions: IdMap }
): NewDebt {
	// 1.x backups predate loans: every debt in them is a credit sale or purchase.
	const kind = row.choice('kind', 'Jenis catatan', ['trade', 'loan'] as const, 'trade');
	const principalAccountId = row.ref('principalAccountId', ids.accounts, 'Akun pokok pinjaman');
	const principalTransactionId = row.ref(
		'principalTransactionId',
		ids.transactions,
		'Transaksi pokok pinjaman'
	);
	if (kind === 'trade' && (principalAccountId || principalTransactionId)) {
		row.fail('Akun dan transaksi pokok hanya diisi untuk pinjaman');
	}
	return {
		id,
		userId,
		type: row.choice('type', 'Tipe', ['piutang', 'hutang'] as const),
		kind,
		principalAccountId,
		principalTransactionId,
		contactName: row.requiredText('contactName', 'Nama kontak', 200),
		contactPhone: row.text('contactPhone', 'Nomor telepon', 20),
		contactAddress: row.text('contactAddress', 'Alamat', 500),
		originalAmount: row.money('originalAmount', 'Jumlah'),
		paidAmount: row.rupiah('paidAmount', 'Jumlah terbayar', 0),
		remainingAmount: row.rupiah('remainingAmount', 'Sisa tagihan'),
		date: row.date('date', 'Tanggal'),
		dueDate: row.optionalDate('dueDate', 'Tanggal jatuh tempo'),
		description: row.text('description', 'Keterangan', 500),
		status: row.choice('status', 'Status', ['active', 'paid', 'overdue'] as const, 'active'),
		isActive: row.flag('isActive', true),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

function readExternalMonthlyRevenue(row: RecordReader): string {
	let value = row.raw('externalMonthlyRevenue');
	if (value === undefined || value === null) return '[]';
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			row.fail('Omzet di luar Buku UMKM tidak valid');
		}
	}
	if (
		!Array.isArray(value) ||
		(value.length !== 0 && value.length !== 12) ||
		value.some((amount) => !Number.isSafeInteger(amount) || amount < 0)
	) {
		row.fail('Omzet di luar Buku UMKM harus berisi 12 angka Rupiah bulat');
	}
	return JSON.stringify(value);
}

function readTaxProfile(row: RecordReader, userId: string): NewTaxProfile {
	const taxYear = row.integer('taxYear', 'Tahun pajak', 2018, 2100);
	return {
		id: crypto.randomUUID(),
		userId,
		taxYear,
		legalForm: row.choice('legalForm', 'Bentuk wajib pajak', LEGAL_FORMS),
		registeredAt: row.date('registeredAt', 'Tanggal pendaftaran wajib pajak'),
		finalRegimeStartYear: row.integer(
			'finalRegimeStartYear',
			'Tahun awal penggunaan tarif final',
			2018,
			taxYear
		),
		regimeChoice: row.choice('regimeChoice', 'Pilihan rezim pajak', REGIME_CHOICES),
		everUsedGeneralRegime: row.flag('everUsedGeneralRegime', false),
		priorYearAggregatedRevenue: row.rupiah(
			'priorYearAggregatedRevenue',
			'Omzet agregat tahun sebelumnya',
			0
		),
		externalMonthlyRevenue: readExternalMonthlyRevenue(row),
		revenueDataComplete: row.flag('revenueDataComplete', false),
		aggregationConfirmed: row.flag('aggregationConfirmed', false),
		hasProfessionalServiceIncome: row.flag('hasProfessionalServiceIncome', false),
		soleOwnerProvidesProfessionalServices: row.flag('soleOwnerProvidesProfessionalServices', false),
		usesOtherTaxFacility: row.flag('usesOtherTaxFacility', false),
		groupTurnoverExceeded: row.optionalFlag('groupTurnoverExceeded'),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

function readTaxRecord(row: RecordReader, userId: string): NewTaxRecord {
	const taxAmount = row.rupiah('taxAmount', 'Jumlah pajak');
	const status = row.choice('status', 'Status pajak', TAX_STATUSES, 'unpaid');
	return {
		id: crypto.randomUUID(),
		userId,
		year: row.integer('year', 'Tahun', 2000, 2100),
		month: row.has('month') ? row.integer('month', 'Bulan', 1, 12) : null,
		taxType: row.choice('taxType', 'Jenis pajak', TAX_TYPES),
		taxableIncome: row.rupiah('taxableIncome', 'Dasar pengenaan pajak'),
		taxRate: row.integer('taxRate', 'Tarif pajak', 0, 10_000),
		taxAmount,
		// Files written before paid_amount existed: a paid record paid its estimate, as
		// migration 0010 assumed for stored rows.
		paidAmount: row.has('paidAmount')
			? row.rupiah('paidAmount', 'Jumlah yang dibayar')
			: status === 'paid'
				? taxAmount
				: null,
		status,
		billingCode: row.text('billingCode', 'Kode billing', 100),
		paymentDate: row.optionalDate('paymentDate', 'Tanggal bayar'),
		notes: row.text('notes', 'Catatan', 1000),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

/**
 * One record per tax period and type, as the unique index (drizzle/0009) requires.
 * Backups written before it may hold duplicates; keep the most recently updated one,
 * as that migration did. Annual records (no month) are not constrained.
 */
function onePerTaxPeriod(records: NewTaxRecord[]): NewTaxRecord[] {
	const latest = new Map<string, NewTaxRecord>();
	const annual: NewTaxRecord[] = [];
	const time = (date: Date | undefined) => date?.getTime() ?? 0;
	for (const record of records) {
		if (record.month === null || record.month === undefined) {
			annual.push(record);
			continue;
		}
		const period = `${record.year}-${record.month}-${record.taxType}`;
		const kept = latest.get(period);
		const newer =
			!kept ||
			time(record.updatedAt) > time(kept.updatedAt) ||
			(time(record.updatedAt) === time(kept.updatedAt) &&
				time(record.createdAt) >= time(kept.createdAt));
		if (newer) latest.set(period, record);
	}
	return [...annual, ...latest.values()];
}

function readTemplate(row: RecordReader, userId: string, categories: IdMap): NewTemplate {
	const type = row.raw('type');
	if (!isCategoryType(type)) row.fail('Tipe template harus income atau expense');
	return {
		id: crypto.randomUUID(),
		userId,
		name: row.check(validateTemplateName(row.raw('name'))),
		type,
		categoryId: row.ref('categoryId', categories, 'Kategori'),
		description: row.check(validateTemplateDescription(row.raw('description'))) ?? null,
		isSystem: row.flag('isSystem', false),
		isActive: row.flag('isActive', true),
		createdAt: row.timestamp('createdAt'),
		updatedAt: row.timestamp('updatedAt')
	};
}

/**
 * 1.x backups carry neither an opening balance nor its date for older accounts: derive
 * them as the 1.x restore did, from the balance and the file's active transactions.
 */
function legacyOpenings(transactions: NewTransaction[]) {
	const movement = new Map<string, number>();
	const earliest = new Map<string, string>();
	for (const item of transactions) {
		if (!item.isActive) continue;
		const effect = item.type === 'income' ? item.amount : -item.amount;
		movement.set(item.accountId, (movement.get(item.accountId) ?? 0) + effect);
		const first = earliest.get(item.accountId);
		if (!first || item.date < first) earliest.set(item.accountId, item.date);
	}
	return { movement, earliest };
}

function readAccount(
	row: RecordReader,
	id: string,
	userId: string,
	accounts: IdMap,
	/** Only for 1.x files; a 2.x account's opening date may legitimately be empty. */
	legacyOpening: ReturnType<typeof legacyOpenings> | null
): NewAccount {
	const balance = row.balance('balance', 'Saldo', legacyOpening ? 0 : undefined);
	const createdAt = row.timestamp('createdAt');
	const openingBalance =
		legacyOpening && !row.has('openingBalance')
			? balance - (legacyOpening.movement.get(id) ?? 0)
			: row.balance('openingBalance', 'Saldo awal');
	const openingDate =
		legacyOpening && !row.has('openingDate')
			? (legacyOpening.earliest.get(id) ?? todayInJakarta(createdAt))
			: row.optionalDate('openingDate', 'Tanggal saldo awal');
	return {
		id,
		userId,
		code: row.requiredText('code', 'Kode akun', 20),
		// 120 as onboarding allows; the account form allows 100.
		name: row.requiredText('name', 'Nama akun', 120),
		type: row.choice('type', 'Tipe akun', ACCOUNT_TYPES),
		subType: row.text('subType', 'Subtipe akun', 50),
		isSystem: row.flag('isSystem', false),
		// Inactive accounts keep their balance: reports still count it.
		isActive: row.flag('isActive', true),
		parentId: row.ref('parentId', accounts, 'Akun induk'),
		balance,
		openingBalance,
		openingDate,
		createdAt,
		updatedAt: row.timestamp('updatedAt')
	};
}

function readPhotoCandidate(
	row: RecordReader,
	transactions: IdMap,
	legacy: boolean
): PhotoCandidate | null {
	const transactionId = row.raw('transactionId');
	const mapped = typeof transactionId === 'string' ? transactions.get(transactionId) : undefined;
	if (!mapped) {
		// 1.x backups listed photos of deleted transactions without the transactions.
		if (legacy) return null;
		row.fail('Transaksi yang dirujuk (transactionId) tidak ada di file backup');
	}
	const claimedKey = row.raw('r2Key');
	return {
		id: crypto.randomUUID(),
		transactionId: mapped,
		claimedKey: typeof claimedKey === 'string' ? claimedKey : '',
		fileName: sanitizePhotoFileName(row.raw('fileName')),
		caption: row.text('caption', 'Keterangan foto', 500),
		createdAt: row.timestamp('createdAt')
	};
}

/**
 * Validates a parsed backup file and turns it into rows for `userId`. Throws a
 * BackupError naming the first problem found; nothing is written here.
 */
export function parseBackup(value: unknown, userId: string): RestorePlan {
	if (!isRow(value)) throw new BackupError('File ini bukan backup Buku UMKM.');
	const version = readVersion(value);
	const legacy = version.major === 1;
	const list = (key: string, label: string, optionalInLegacy = false) =>
		readers(value, key, label, !(legacy && optionalInLegacy));

	const profileRows = list('businessProfiles', 'profil usaha');
	const accountRows = list('accounts', 'akun');
	const categoryRows = list('categories', 'kategori');
	const transactionRows = list('transactions', 'transaksi');
	const debtRows = list('debts', 'hutang/piutang');
	const paymentRows = list('debtPayments', 'pembayaran hutang/piutang');
	// Tax profiles arrived in backup 1.2.
	const taxProfileRows = list('taxProfiles', 'profil pajak', true);
	const taxRecordRows = list('taxRecords', 'catatan pajak');
	const templateRows = list('templates', 'template transaksi');
	const photoRows = list('photos', 'foto transaksi');

	const rowCount = [
		profileRows,
		accountRows,
		categoryRows,
		transactionRows,
		debtRows,
		paymentRows,
		taxProfileRows,
		taxRecordRows,
		templateRows,
		photoRows
	].reduce((sum, rows) => sum + rows.length, 0);
	if (rowCount > MAX_RESTORE_ROWS) {
		throw new BackupError(
			`Backup terlalu besar untuk dipulihkan sekaligus: berisi ${rowCount.toLocaleString('id-ID')} baris data, batasnya ${MAX_RESTORE_ROWS.toLocaleString('id-ID')}.`,
			413,
			'BACKUP_TOO_LARGE'
		);
	}

	const ids = {
		accounts: freshIds(accountRows),
		categories: freshIds(categoryRows),
		transactions: freshIds(transactionRows),
		debts: freshIds(debtRows)
	};
	const newId = (map: IdMap, row: RecordReader) => map.get(row.id())!;

	const transactions = transactionRows.map((row) =>
		readTransaction(row, newId(ids.transactions, row), userId, ids)
	);
	const debtOfTransaction = new Map(transactions.map((item) => [item.id!, item.debtId ?? null]));
	const debts = debtRows.map((row) => {
		const item = readDebt(row, newId(ids.debts, row), userId, ids);
		if (
			item.principalTransactionId &&
			debtOfTransaction.get(item.principalTransactionId) !== item.id
		) {
			row.fail('Transaksi pokok pinjaman tidak terhubung ke pinjaman ini');
		}
		return item;
	});
	const opening = legacy ? legacyOpenings(transactions) : null;
	const accounts = accountRows.map((row) =>
		readAccount(row, newId(ids.accounts, row), userId, ids.accounts, opening)
	);

	const payments = paymentRows.map((row): NewPayment => ({
		id: crypto.randomUUID(),
		userId,
		debtId: row.requiredRef('debtId', ids.debts, 'Hutang/piutang'),
		amount: row.money('amount', 'Jumlah pembayaran'),
		date: row.date('date', 'Tanggal'),
		accountId: row.requiredRef('accountId', ids.accounts, 'Akun'),
		transactionId: row.ref('transactionId', ids.transactions, 'Transaksi pembayaran'),
		notes: row.text('notes', 'Catatan', 1000),
		createdAt: row.timestamp('createdAt')
	}));

	const taxYears = new Set<number>();
	const taxProfiles = taxProfileRows.map((row) => {
		const item = readTaxProfile(row, userId);
		if (taxYears.has(item.taxYear)) {
			row.fail(`profil pajak tahun ${item.taxYear} tercatat dua kali`);
		}
		taxYears.add(item.taxYear);
		return item;
	});

	const photoCandidates: PhotoCandidate[] = [];
	for (const row of photoRows) {
		const candidate = readPhotoCandidate(row, ids.transactions, legacy);
		if (candidate) photoCandidates.push(candidate);
	}

	return {
		schemaVersion: version.text,
		businessProfile: readBusinessProfile(profileRows, userId),
		onboardingState: readOnboardingState(value, userId),
		accounts,
		categories: categoryRows.map((row) => readCategory(row, newId(ids.categories, row), userId)),
		debts,
		transactions,
		payments,
		taxProfiles,
		taxRecords: onePerTaxPeriod(taxRecordRows.map((row) => readTaxRecord(row, userId))),
		templates: templateRows.map((row) => readTemplate(row, userId, ids.categories)),
		photoCandidates,
		photosWithoutTransaction: photoRows.length - photoCandidates.length
	};
}

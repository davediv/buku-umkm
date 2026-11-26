/*
 * The backup file: one JSON document holding every row a user owns, keyed by the ids
 * they had when it was written. Restore never reuses those ids; it only uses them to
 * rebuild the links between rows of the same file (see ./restore.ts).
 *
 * Versions:
 * - 1.x: written before November 2026. Only active transactions, no debt kind or loan
 *   columns, no onboarding state; 1.0/1.1 also lack tax profiles and opening balances.
 * - 2.0: every row, including deleted transactions and debts, every debt column, the
 *   onboarding state, the tax profile's group-turnover answer and the tax actually
 *   paid, with `format` set.
 */

/** Identifies a Buku UMKM backup from version 2 on. */
export const BACKUP_FORMAT = 'buku-umkm-backup';

/** Written into new backups. Restore accepts major versions 1 and 2. */
export const BACKUP_SCHEMA_VERSION = '2.0.0';

export const SUPPORTED_BACKUP_MAJOR_VERSIONS = [1, 2] as const;

/**
 * The largest backup file restore reads, refused from Content-Length before reading when
 * declared. Parsed, a 9 MB file and the rows built from it take about 40 MB of heap,
 * inside a Worker isolate's 128 MB, which concurrent requests share.
 */
export { MAX_BACKUP_BYTES } from '$lib/constants';

/**
 * The most rows one restore writes, checked before any row is read. A restore is one D1
 * batch, and D1 must finish a call within 30 seconds. Measured on local D1: a 9 MB
 * backup of 25,000 transactions is 5,000 insert statements, about 0.5 s of Worker CPU to
 * build and 6-7 s to run (replacing an equal book included). 30,000 rows keeps the batch
 * well inside the limit, and a 10 MB file holds about 27,000 transactions anyway.
 */
export const MAX_RESTORE_ROWS = 30_000;

/** Room for the multipart boundary and part headers around an uploaded backup file. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export type BackupTimestamp = string | null;

export type BackupBusinessProfile = {
	id: string;
	name: string;
	address: string | null;
	phone: string | null;
	/** Encrypted with this deployment's NPWP_ENCRYPTION_KEY, never plain text. */
	npwp: string | null;
	businessType: string;
	ownerName: string | null;
	industry: string | null;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupOnboardingState = {
	status: string;
	completedAt: BackupTimestamp;
	skippedAt: BackupTimestamp;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupAccount = {
	id: string;
	code: string;
	name: string;
	type: string;
	subType: string | null;
	isSystem: boolean;
	isActive: boolean;
	parentId: string | null;
	balance: number;
	openingBalance: number;
	openingDate: string | null;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupCategory = {
	id: string;
	code: string;
	name: string;
	type: string;
	isSystem: boolean;
	isActive: boolean;
	icon: string | null;
	color: string | null;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupTransaction = {
	id: string;
	date: string;
	type: string;
	amount: number;
	description: string | null;
	accountId: string;
	toAccountId: string | null;
	categoryId: string | null;
	debtId: string | null;
	isTaxed: boolean;
	taxAmount: number;
	referenceNumber: string | null;
	notes: string | null;
	isActive: boolean;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupDebt = {
	id: string;
	type: string;
	kind: string;
	principalAccountId: string | null;
	principalTransactionId: string | null;
	contactName: string;
	contactPhone: string | null;
	contactAddress: string | null;
	originalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	date: string;
	dueDate: string | null;
	description: string | null;
	status: string;
	isActive: boolean;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupDebtPayment = {
	id: string;
	debtId: string;
	amount: number;
	date: string;
	accountId: string;
	transactionId: string | null;
	notes: string | null;
	createdAt: BackupTimestamp;
};

export type BackupTaxProfile = {
	id: string;
	taxYear: number;
	legalForm: string;
	registeredAt: string;
	finalRegimeStartYear: number;
	regimeChoice: string;
	everUsedGeneralRegime: boolean;
	priorYearAggregatedRevenue: number;
	/** JSON array of 12 monthly amounts, as stored. */
	externalMonthlyRevenue: string;
	revenueDataComplete: boolean;
	aggregationConfirmed: boolean;
	hasProfessionalServiceIncome: boolean;
	soleOwnerProvidesProfessionalServices: boolean;
	usesOtherTaxFacility: boolean;
	/** Null until the owner answers (drizzle/0008). */
	groupTurnoverExceeded: boolean | null;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupTaxRecord = {
	id: string;
	year: number;
	month: number | null;
	taxType: string;
	taxableIncome: number;
	taxRate: number;
	taxAmount: number;
	/** What the owner says was paid (drizzle/0010); null when not recorded. */
	paidAmount: number | null;
	status: string;
	billingCode: string | null;
	paymentDate: string | null;
	notes: string | null;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

export type BackupTemplate = {
	id: string;
	name: string;
	type: string;
	categoryId: string | null;
	description: string | null;
	isSystem: boolean;
	isActive: boolean;
	createdAt: BackupTimestamp;
	updatedAt: BackupTimestamp;
};

/** Photo metadata only: the image itself stays in R2 and is not in the file. */
export type BackupPhoto = {
	id: string;
	transactionId: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	/** Where the image was stored; restore only trusts it after checking R2 (see restore.ts). */
	r2Key: string;
	caption: string | null;
	createdAt: BackupTimestamp;
};

export type BackupDocument = {
	format: typeof BACKUP_FORMAT;
	schemaVersion: string;
	appVersion: string;
	backupDate: string;
	businessName: string;
	contents: {
		/** Receipt images are never in the file; only their metadata is. */
		photoImages: 'not_included';
		/** The NPWP can only be read back by a deployment with the same encryption key. */
		npwp: 'encrypted';
	};
	businessProfiles: BackupBusinessProfile[];
	onboardingState: BackupOnboardingState | null;
	accounts: BackupAccount[];
	categories: BackupCategory[];
	transactions: BackupTransaction[];
	debts: BackupDebt[];
	debtPayments: BackupDebtPayment[];
	taxProfiles: BackupTaxProfile[];
	taxRecords: BackupTaxRecord[];
	templates: BackupTemplate[];
	photos: BackupPhoto[];
};

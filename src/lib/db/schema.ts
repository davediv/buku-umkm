// IndexedDB type definitions mirroring D1 schema
// Types for local-first storage

// Sync status for tracking offline/online sync state
export type SyncStatus = 'pending' | 'synced' | 'error';

// Base type with sync tracking
export interface BaseRecord {
	id: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// User Extension
// ============================================================================

export interface UserExtensionRecord {
	id: string;
	npwp: string | null;
	npwpType: 'perorangan' | 'badan' | null;
	businessName: string | null;
	businessType: string | null;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Business Profile
// ============================================================================

export interface BusinessProfileRecord {
	id: string;
	userId: string;
	name: string;
	address: string | null;
	phone: string | null;
	npwp: string | null;
	businessType: string;
	ownerName: string | null;
	industry: string | null;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Chart of Account (Akun)
// ============================================================================

export interface ChartOfAccountRecord {
	id: string;
	userId: string;
	code: string;
	name: string;
	type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
	subType: string | null;
	isSystem: boolean;
	isActive: boolean;
	parentId: string | null;
	balance: number;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Category
// ============================================================================

export interface CategoryRecord {
	id: string;
	userId: string;
	code: string;
	name: string;
	type: 'income' | 'expense';
	isSystem: boolean;
	isActive: boolean;
	icon: string | null;
	color: string | null;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Transaction
// ============================================================================

export interface TransactionRecord {
	id: string;
	userId: string;
	date: string;
	type: 'income' | 'expense' | 'transfer';
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
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Debt (Piutang/Hutang)
// ============================================================================

export interface DebtRecord {
	id: string;
	userId: string;
	type: 'piutang' | 'hutang';
	contactName: string;
	contactPhone: string | null;
	contactAddress: string | null;
	originalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	date: string;
	dueDate: string | null;
	description: string | null;
	status: 'active' | 'paid' | 'overdue';
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Debt Payment
// ============================================================================

export interface DebtPaymentRecord {
	id: string;
	debtId: string;
	userId: string;
	amount: number;
	date: string;
	accountId: string;
	transactionId: string | null;
	notes: string | null;
	createdAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Tax Record
// ============================================================================

export interface TaxRecordRecord {
	id: string;
	userId: string;
	year: number;
	month: number | null;
	taxType: string;
	taxableIncome: number;
	taxRate: number;
	taxAmount: number;
	status: 'unpaid' | 'paid' | 'overdue';
	billingCode: string | null;
	paymentDate: string | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Transaction Photo
// ============================================================================

export interface TransactionPhotoRecord {
	id: string;
	transactionId: string;
	userId: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	r2Key: string;
	r2Url: string | null;
	caption: string | null;
	createdAt: Date;
	syncStatus: SyncStatus;
}

// ============================================================================
// Backup
// ============================================================================

export interface BackupRecord {
	id: string;
	userId: string;
	type: 'full' | 'partial';
	fileName: string;
	fileSize: number;
	r2Key: string;
	recordCount: number;
	includes: string;
	status: 'pending' | 'completed' | 'failed';
	createdAt: Date;
	syncStatus: SyncStatus;
}

import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

// Import auth tables to define cross-cutting relations
import { user, session, account } from './auth.schema';

// Re-export auth schema
export * from './auth.schema';

// Add relations to auth user table for business tables
export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	// Business table relations
	extension: many(userExtension),
	businessProfiles: many(businessProfile),
	chartOfAccounts: many(chartOfAccount),
	categories: many(category),
	transactions: many(transaction),
	transactionPhotos: many(transactionPhoto),
	debts: many(debt),
	debtPayments: many(debtPayment),
	taxRecords: many(taxRecord),
	backups: many(backup),
	transactionTemplates: many(transactionTemplate)
}));

// ============================================================================
// Timestamp Helpers - Match auth.schema.ts pattern
// ============================================================================

const timestampColumns = {
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull()
};

// ============================================================================
// User Extension - Extended from Better Auth with business fields
// ============================================================================

export const userExtension = sqliteTable('user_extension', {
	id: text('id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	npwp: text('npwp'),
	npwpType: text('npwp_type'), // 'perorangan' | 'badan'
	businessName: text('business_name'),
	businessType: text('business_type'), // 'warung_makan' | 'toko_kelontong' | 'jasa' | 'manufaktur'
	...timestampColumns
});

export const userExtensionRelations = relations(userExtension, ({ one }) => ({
	user: one(user, {
		fields: [userExtension.id],
		references: [user.id]
	})
}));

// ============================================================================
// Business Profile
// ============================================================================

export const businessProfile = sqliteTable(
	'business_profile',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		address: text('address'),
		phone: text('phone'),
		npwp: text('npwp'),
		businessType: text('business_type').notNull(), // 'warung_makan' | 'toko_kelontong' | 'jasa' | 'manufaktur'
		ownerName: text('owner_name'),
		industry: text('industry'),
		...timestampColumns
	},
	(table) => [index('business_profile_userId_idx').on(table.userId)]
);

export const businessProfileRelations = relations(businessProfile, ({ one }) => ({
	user: one(user, {
		fields: [businessProfile.userId],
		references: [user.id]
	})
}));

// ============================================================================
// Chart of Accounts (Akun) - Renamed to avoid collision with auth.account
// ============================================================================

export const chartOfAccount = sqliteTable(
	'chart_of_account',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		code: text('code').notNull(), // SAK EMKM code: 1xxx-8xxx
		name: text('name').notNull(),
		type: text('type').notNull(), // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
		subType: text('sub_type'), // 'kas' | 'bank' | 'piutang' | 'persediaan' | 'aktiva_tetap' | etc.
		isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
		parentId: text('parent_id'), // For hierarchical accounts
		balance: integer('balance').default(0).notNull(), // Current balance in Rupiah (integer)
		...timestampColumns
	},
	(table) => [
		index('chart_of_account_userId_idx').on(table.userId),
		index('chart_of_account_code_idx').on(table.code),
		index('chart_of_account_type_idx').on(table.type)
	]
);

export const chartOfAccountRelations = relations(chartOfAccount, ({ one, many }) => ({
	user: one(user, {
		fields: [chartOfAccount.userId],
		references: [user.id]
	}),
	parent: one(chartOfAccount, {
		fields: [chartOfAccount.parentId],
		references: [chartOfAccount.id],
		relationName: 'parent_account'
	}),
	children: many(chartOfAccount, {
		relationName: 'parent_account'
	})
}));

// ============================================================================
// Category (Kategori)
// ============================================================================

export const category = sqliteTable(
	'category',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		code: text('code').notNull(), // SAK EMKM code: 1xxx-8xxx
		name: text('name').notNull(),
		type: text('type').notNull(), // 'income' | 'expense'
		isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
		icon: text('icon'), // Lucide icon name
		color: text('color'), // Hex color
		...timestampColumns
	},
	(table) => [
		index('category_userId_idx').on(table.userId),
		index('category_code_idx').on(table.code),
		index('category_type_idx').on(table.type)
	]
);

export const categoryRelations = relations(category, ({ one }) => ({
	user: one(user, {
		fields: [category.userId],
		references: [user.id]
	})
}));

// ============================================================================
// Transaction (Transaksi)
// ============================================================================

export const transaction = sqliteTable(
	'transaction',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		date: text('date').notNull(), // ISO 8601 date
		type: text('type').notNull(), // 'income' | 'expense' | 'transfer'
		amount: integer('amount').notNull(), // Amount in Rupiah (integer)
		description: text('description'),
		accountId: text('account_id')
			.notNull()
			.references(() => chartOfAccount.id, { onDelete: 'cascade' }), // Source/destination account
		toAccountId: text('to_account_id').references(() => chartOfAccount.id, { onDelete: 'cascade' }), // For transfers
		categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
		debtId: text('debt_id').references(() => debt.id, { onDelete: 'set null' }), // Associated debt (if any)
		isTaxed: integer('is_taxed', { mode: 'boolean' }).default(false).notNull(), // PPh 0.5% applied
		taxAmount: integer('tax_amount').default(0).notNull(), // Tax amount in Rupiah
		referenceNumber: text('reference_number'), // Invoice/receipt number
		notes: text('notes'),
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(), // Soft delete
		...timestampColumns
	},
	(table) => [
		index('transaction_userId_idx').on(table.userId),
		index('transaction_date_idx').on(table.date),
		index('transaction_type_idx').on(table.type),
		index('transaction_accountId_idx').on(table.accountId),
		index('transaction_toAccountId_idx').on(table.toAccountId),
		index('transaction_categoryId_idx').on(table.categoryId),
		index('transaction_isActive_idx').on(table.isActive)
	]
);

export const transactionRelations = relations(transaction, ({ one }) => ({
	user: one(user, {
		fields: [transaction.userId],
		references: [user.id]
	}),
	account: one(chartOfAccount, {
		fields: [transaction.accountId],
		references: [chartOfAccount.id],
		relationName: 'transaction_account'
	}),
	toAccount: one(chartOfAccount, {
		fields: [transaction.toAccountId],
		references: [chartOfAccount.id],
		relationName: 'transaction_to_account'
	}),
	category: one(category, {
		fields: [transaction.categoryId],
		references: [category.id]
	}),
	debt: one(debt, {
		fields: [transaction.debtId],
		references: [debt.id]
	})
}));

// ============================================================================
// Transaction Photo (Foto Transaksi)
// ============================================================================

export const transactionPhoto = sqliteTable(
	'transaction_photo',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		transactionId: text('transaction_id')
			.notNull()
			.references(() => transaction.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		fileSize: integer('file_size').notNull(), // Size in bytes
		mimeType: text('mime_type').notNull(),
		r2Key: text('r2_key').notNull(), // R2 object key
		r2Url: text('r2_url'), // Public R2 URL
		caption: text('caption'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('transaction_photo_transactionId_idx').on(table.transactionId),
		index('transaction_photo_userId_idx').on(table.userId)
	]
);

export const transactionPhotoRelations = relations(transactionPhoto, ({ one }) => ({
	transaction: one(transaction, {
		fields: [transactionPhoto.transactionId],
		references: [transaction.id]
	}),
	user: one(user, {
		fields: [transactionPhoto.userId],
		references: [user.id]
	})
}));

// ============================================================================
// Debt (Piutang/Hutang)
// ============================================================================

export const debt = sqliteTable(
	'debt',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // 'piutang' (receivable) | 'hutang' (payable)
		contactName: text('contact_name').notNull(), // Customer/supplier name
		contactPhone: text('contact_phone'),
		contactAddress: text('contact_address'),
		originalAmount: integer('original_amount').notNull(), // Original amount in Rupiah
		paidAmount: integer('paid_amount').default(0).notNull(), // Paid amount in Rupiah
		remainingAmount: integer('remaining_amount').notNull(), // Remaining amount in Rupiah
		date: text('date').notNull(), // ISO 8601 date when debt was created
		dueDate: text('due_date'), // ISO 8601 due date
		description: text('description'),
		status: text('status').notNull().default('active'), // 'active' | 'paid' | 'overdue'
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(), // Soft delete
		...timestampColumns
	},
	(table) => [
		index('debt_userId_idx').on(table.userId),
		index('debt_type_idx').on(table.type),
		index('debt_status_idx').on(table.status),
		index('debt_dueDate_idx').on(table.dueDate),
		index('debt_isActive_idx').on(table.isActive)
	]
);

export const debtRelations = relations(debt, ({ one, many }) => ({
	user: one(user, {
		fields: [debt.userId],
		references: [user.id]
	}),
	payments: many(debtPayment)
}));

// ============================================================================
// Debt Payment (Pembayaran Piutang/Hutang)
// ============================================================================

export const debtPayment = sqliteTable(
	'debt_payment',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		debtId: text('debt_id')
			.notNull()
			.references(() => debt.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		amount: integer('amount').notNull(), // Payment amount in Rupiah
		date: text('date').notNull(), // ISO 8601 date
		accountId: text('account_id')
			.notNull()
			.references(() => chartOfAccount.id, { onDelete: 'cascade' }), // Account where payment is recorded
		transactionId: text('transaction_id').references(() => transaction.id, {
			onDelete: 'set null'
		}), // Associated transaction
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('debt_payment_debtId_idx').on(table.debtId),
		index('debt_payment_userId_idx').on(table.userId),
		index('debt_payment_date_idx').on(table.date),
		index('debt_payment_transactionId_idx').on(table.transactionId)
	]
);

export const debtPaymentRelations = relations(debtPayment, ({ one }) => ({
	debt: one(debt, {
		fields: [debtPayment.debtId],
		references: [debt.id]
	}),
	user: one(user, {
		fields: [debtPayment.userId],
		references: [user.id]
	}),
	account: one(chartOfAccount, {
		fields: [debtPayment.accountId],
		references: [chartOfAccount.id]
	}),
	transaction: one(transaction, {
		fields: [debtPayment.transactionId],
		references: [transaction.id]
	})
}));

// ============================================================================
// Tax Record (Pajak)
// ============================================================================

export const taxRecord = sqliteTable(
	'tax_record',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		year: integer('year').notNull(),
		month: integer('month'), // 1-12, null for annual
		taxType: text('tax_type').notNull(), // 'pph_final' | 'ppn' | etc.
		taxableIncome: integer('taxable_income').notNull(), // Bruto income subject to tax
		taxRate: integer('tax_rate').notNull(), // Rate in basis points (50 = 0.5%)
		taxAmount: integer('tax_amount').notNull(), // Calculated tax in Rupiah
		status: text('status').notNull().default('unpaid'), // 'unpaid' | 'paid' | 'overdue'
		billingCode: text('billing_code'), // NTPN code
		paymentDate: text('payment_date'), // ISO 8601 date when paid
		notes: text('notes'),
		...timestampColumns
	},
	(table) => [
		index('tax_record_userId_idx').on(table.userId),
		index('tax_record_year_idx').on(table.year),
		index('tax_record_month_idx').on(table.month),
		index('tax_record_status_idx').on(table.status)
	]
);

export const taxRecordRelations = relations(taxRecord, ({ one }) => ({
	user: one(user, {
		fields: [taxRecord.userId],
		references: [user.id]
	})
}));

// ============================================================================
// Backup (Cadangan)
// ============================================================================

export const backup = sqliteTable(
	'backup',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(), // 'full' | 'partial'
		fileName: text('file_name').notNull(),
		fileSize: integer('file_size').notNull(), // Size in bytes
		r2Key: text('r2_key').notNull(), // R2 object key
		recordCount: integer('record_count').notNull(), // Number of records backed up
		includes: text('includes').notNull(), // JSON array of included tables
		status: text('status').notNull().default('completed'), // 'pending' | 'completed' | 'failed'
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('backup_userId_idx').on(table.userId),
		index('backup_type_idx').on(table.type),
		index('backup_status_idx').on(table.status)
	]
);

export const backupRelations = relations(backup, ({ one }) => ({
	user: one(user, {
		fields: [backup.userId],
		references: [user.id]
	})
}));

// ============================================================================
// Transaction Template (Template Transaksi)
// ============================================================================

export const transactionTemplate = sqliteTable(
	'transaction_template',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: text('type').notNull(), // 'income' | 'expense'
		categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
		description: text('description'),
		isSystem: integer('is_system', { mode: 'boolean' }).default(false).notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
		...timestampColumns
	},
	(table) => [
		index('transaction_template_userId_idx').on(table.userId),
		index('transaction_template_type_idx').on(table.type),
		index('transaction_template_categoryId_idx').on(table.categoryId),
		index('transaction_template_isSystem_idx').on(table.isSystem),
		index('transaction_template_isActive_idx').on(table.isActive)
	]
);

export const transactionTemplateRelations = relations(transactionTemplate, ({ one }) => ({
	user: one(user, {
		fields: [transactionTemplate.userId],
		references: [user.id]
	}),
	category: one(category, {
		fields: [transactionTemplate.categoryId],
		references: [category.id]
	})
}));

import { relations, sql } from 'drizzle-orm';
import {
	integer,
	sqliteTable,
	text,
	index,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';

// Import auth tables to define cross-cutting relations
import { user, session, account } from './auth.schema';

// Re-export auth schema
export * from './auth.schema';

/*
 * Tenant scoping: every relation between business tables joins on its foreign key AND
 * userId, so a relational `with:` load can never pull another user's row, even if a
 * foreign key were to point across tenants. `many` relations reuse the reverse `one`
 * relation's columns, so they are scoped the same way.
 */

// Add relations to auth user table for business tables
export const userRelations = relations(user, ({ many, one }) => ({
	sessions: many(session),
	accounts: many(account),
	// Business table relations
	extension: many(userExtension),
	onboardingState: one(onboardingState),
	businessProfiles: many(businessProfile),
	chartOfAccounts: many(chartOfAccount),
	categories: many(category),
	transactions: many(transaction),
	transactionPhotos: many(transactionPhoto),
	debts: many(debt),
	debtPayments: many(debtPayment),
	taxRecords: many(taxRecord),
	taxProfiles: many(taxProfile),
	backups: many(backup),
	transactionTemplates: many(transactionTemplate),
	financialCommands: many(financialCommand)
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
// Onboarding State
// ============================================================================

export const onboardingState = sqliteTable('onboarding_state', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	status: text('status').notNull(), // 'completed' | 'skipped'
	completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
	skippedAt: integer('skipped_at', { mode: 'timestamp_ms' }),
	...timestampColumns
});

export const onboardingStateRelations = relations(onboardingState, ({ one }) => ({
	user: one(user, {
		fields: [onboardingState.userId],
		references: [user.id]
	})
}));

// ============================================================================
// Idempotent Financial Commands
// ============================================================================

export const financialCommand = sqliteTable(
	'financial_command',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		idempotencyKey: text('idempotency_key').notNull(),
		kind: text('kind').notNull(),
		result: text('result').notNull(), // JSON containing canonical entity identifiers
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		uniqueIndex('financial_command_user_key_unique').on(table.userId, table.idempotencyKey),
		index('financial_command_user_created_idx').on(table.userId, table.createdAt)
	]
);

export const financialCommandRelations = relations(financialCommand, ({ one }) => ({
	user: one(user, {
		fields: [financialCommand.userId],
		references: [user.id]
	})
}));

/**
 * Never holds rows. Its BEFORE INSERT trigger (drizzle/0006) silently drops a row
 * with ok = 1 and aborts the statement, and with it the whole D1 batch, when ok = 0.
 * See batchGuard() in $lib/server/db/batch.
 */
export const financeGuard = sqliteTable('finance_guard', {
	ok: integer('ok').notNull()
});

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
		openingBalance: integer('opening_balance').default(0).notNull(),
		openingDate: text('opening_date'), // ISO 8601 date when the opening balance becomes effective
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
		fields: [chartOfAccount.parentId, chartOfAccount.userId],
		references: [chartOfAccount.id, chartOfAccount.userId],
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
		index('transaction_user_date_type_idx').on(table.userId, table.date, table.type),
		index('transaction_user_active_date_created_idx').on(
			table.userId,
			table.isActive,
			table.date,
			table.createdAt
		),
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
		fields: [transaction.accountId, transaction.userId],
		references: [chartOfAccount.id, chartOfAccount.userId],
		relationName: 'transaction_account'
	}),
	toAccount: one(chartOfAccount, {
		fields: [transaction.toAccountId, transaction.userId],
		references: [chartOfAccount.id, chartOfAccount.userId],
		relationName: 'transaction_to_account'
	}),
	category: one(category, {
		fields: [transaction.categoryId, transaction.userId],
		references: [category.id, category.userId]
	}),
	debt: one(debt, {
		fields: [transaction.debtId, transaction.userId],
		references: [debt.id, debt.userId]
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
		fields: [transactionPhoto.transactionId, transactionPhoto.userId],
		references: [transaction.id, transaction.userId]
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
		// 'trade': a credit sale (piutang) or purchase (hutang), recognised as revenue or
		// expense on `date`. 'loan': money lent (piutang) or borrowed (hutang); never
		// revenue or expense, its principal moves cash through `principalAccountId`.
		kind: text('kind').notNull().default('trade'),
		// Loans only: the cash/bank account the principal moved through, and the
		// transaction (with debtId = this debt) that moved it.
		principalAccountId: text('principal_account_id').references(
			(): AnySQLiteColumn => chartOfAccount.id,
			{ onDelete: 'set null' }
		),
		principalTransactionId: text('principal_transaction_id').references(
			(): AnySQLiteColumn => transaction.id,
			{ onDelete: 'set null' }
		),
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
		index('debt_isActive_idx').on(table.isActive),
		index('debt_principalTransactionId_idx').on(table.principalTransactionId)
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
		fields: [debtPayment.debtId, debtPayment.userId],
		references: [debt.id, debt.userId]
	}),
	user: one(user, {
		fields: [debtPayment.userId],
		references: [user.id]
	}),
	account: one(chartOfAccount, {
		fields: [debtPayment.accountId, debtPayment.userId],
		references: [chartOfAccount.id, chartOfAccount.userId]
	}),
	transaction: one(transaction, {
		fields: [debtPayment.transactionId, debtPayment.userId],
		references: [transaction.id, transaction.userId]
	})
}));

// ============================================================================
// Tax Profile (versioned by tax year)
// ============================================================================

export const taxProfile = sqliteTable(
	'tax_profile',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		taxYear: integer('tax_year').notNull(),
		legalForm: text('legal_form').notNull(),
		registeredAt: text('registered_at').notNull(),
		finalRegimeStartYear: integer('final_regime_start_year').notNull(),
		regimeChoice: text('regime_choice').notNull(),
		// Chose (and notified DJP of) the Pasal 17 rates: permanent for every legal form.
		everUsedGeneralRegime: integer('ever_used_general_regime', { mode: 'boolean' })
			.default(false)
			.notNull(),
		// The taxpayer's own turnover passed Rp4.8 billion in an earlier tax year. Whether that is
		// permanent depends on the legal form and tax year (src/lib/tax/eligibility.ts).
		turnoverLimitExceeded: integer('turnover_limit_exceeded', { mode: 'boolean' })
			.default(false)
			.notNull(),
		priorYearAggregatedRevenue: integer('prior_year_aggregated_revenue').default(0).notNull(),
		externalMonthlyRevenue: text('external_monthly_revenue').default('[]').notNull(),
		revenueDataComplete: integer('revenue_data_complete', { mode: 'boolean' })
			.default(false)
			.notNull(),
		aggregationConfirmed: integer('aggregation_confirmed', { mode: 'boolean' })
			.default(false)
			.notNull(),
		hasProfessionalServiceIncome: integer('has_professional_service_income', {
			mode: 'boolean'
		})
			.default(false)
			.notNull(),
		soleOwnerProvidesProfessionalServices: integer('sole_owner_provides_professional_services', {
			mode: 'boolean'
		})
			.default(false)
			.notNull(),
		usesOtherTaxFacility: integer('uses_other_tax_facility', { mode: 'boolean' })
			.default(false)
			.notNull(),
		// Pasal 57 ayat (2) huruf e PP 20/2026; null = not answered yet.
		groupTurnoverExceeded: integer('group_turnover_exceeded', { mode: 'boolean' }),
		...timestampColumns
	},
	(table) => [
		uniqueIndex('tax_profile_user_year_unique').on(table.userId, table.taxYear),
		index('tax_profile_user_idx').on(table.userId),
		index('tax_profile_year_idx').on(table.taxYear)
	]
);

export const taxProfileRelations = relations(taxProfile, ({ one }) => ({
	user: one(user, {
		fields: [taxProfile.userId],
		references: [user.id]
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
		// Amount the taxpayer says was actually paid, in Rupiah; null when not recorded.
		paidAmount: integer('paid_amount'),
		status: text('status').notNull().default('unpaid'), // 'unpaid' | 'paid' | 'overdue'
		billingCode: text('billing_code'), // Optional official billing/payment reference supplied by user
		paymentDate: text('payment_date'), // ISO 8601 date when paid
		notes: text('notes'),
		...timestampColumns
	},
	(table) => [
		// One record per tax period and type; mark-paid upserts on it. It also serves
		// user_id lookups, so no separate user_id index is needed.
		uniqueIndex('tax_record_user_period_type_unique').on(
			table.userId,
			table.year,
			table.month,
			table.taxType
		),
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
		fields: [transactionTemplate.categoryId, transactionTemplate.userId],
		references: [category.id, category.userId]
	})
}));

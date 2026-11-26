import {
	asc,
	desc,
	eq,
	and,
	gte,
	lte,
	lt,
	inArray,
	isNotNull,
	isNull,
	like,
	or,
	sql
} from 'drizzle-orm';
import type { SQLiteDb } from '../index';
import { todayInJakarta } from '$lib/shared/dates';
import {
	chartOfAccount,
	category,
	transaction,
	debt,
	taxRecord,
	businessProfile,
	transactionPhoto,
	transactionTemplate
} from '../schema';
import {
	CREDIT_PURCHASES_LABEL,
	CREDIT_SALES_LABEL,
	cashMovementRows,
	profitAndLossRows,
	profitAndLossTotals,
	reportPeriodRanges,
	tradeDebtRows,
	type ReportPeriod
} from './ledger';

// ============================================================================
// Account Queries
// ============================================================================

export const chartOfAccountQueries = {
	/**
	 * Get all chartOfAccounts for a user
	 */
	findAll(db: SQLiteDb, userId: string) {
		return db.query.chartOfAccount.findMany({
			where: (chartOfAccounts, { eq }) => eq(chartOfAccounts.userId, userId),
			orderBy: (chartOfAccounts, { asc }) => [asc(chartOfAccounts.code)]
		});
	},

	/**
	 * Get chartOfAccount by ID
	 */
	findById(db: SQLiteDb, userId: string, accountId: string) {
		return db.query.chartOfAccount.findFirst({
			where: (chartOfAccounts, { eq }) =>
				and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.id, accountId))
		});
	},

	/**
	 * Get chartOfAccount by code
	 */
	findByCode(db: SQLiteDb, userId: string, code: string) {
		return db.query.chartOfAccount.findFirst({
			where: (chartOfAccounts, { eq }) =>
				and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.code, code))
		});
	},

	/**
	 * Get chartOfAccounts by type
	 */
	findByType(db: SQLiteDb, userId: string, type: string) {
		return db.query.chartOfAccount.findMany({
			where: (chartOfAccounts, { eq }) =>
				and(eq(chartOfAccounts.userId, userId), eq(chartOfAccounts.type, type)),
			orderBy: (chartOfAccounts, { asc }) => [asc(chartOfAccounts.code)]
		});
	},

	/**
	 * Create new chartOfAccount
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			code: string;
			name: string;
			type: string;
			subType?: string;
			parentId?: string;
		}
	) {
		return db.insert(chartOfAccount).values({
			id: crypto.randomUUID(),
			userId: data.userId,
			code: data.code,
			name: data.name,
			type: data.type,
			subType: data.subType ?? null,
			parentId: data.parentId ?? null,
			isSystem: false,
			isActive: true,
			balance: 0,
			openingBalance: 0,
			openingDate: todayInJakarta()
		});
	},

	/**
	 * Update chartOfAccount
	 */
	update(
		db: SQLiteDb,
		userId: string,
		accountId: string,
		data: {
			name?: string;
			code?: string;
			type?: string;
			subType?: string;
			isActive?: boolean;
		}
	) {
		const updates: Record<string, unknown> = { ...data };
		return db
			.update(chartOfAccount)
			.set(updates)
			.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
	},

	/**
	 * Update chartOfAccount balance
	 */
	updateBalance(db: SQLiteDb, userId: string, accountId: string, amount: number) {
		return db
			.update(chartOfAccount)
			.set({ balance: sql`${chartOfAccount.balance} + ${amount}` })
			.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
	},

	/**
	 * Delete chartOfAccount
	 */
	delete(db: SQLiteDb, userId: string, accountId: string) {
		return db
			.delete(chartOfAccount)
			.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.id, accountId)));
	},

	/**
	 * Get total balance by type
	 */
	getTotalBalanceByType(db: SQLiteDb, userId: string, type: string) {
		return db
			.select({
				total: sql`SUM(${chartOfAccount.balance})`
			})
			.from(chartOfAccount)
			.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.type, type)))
			.then((rows) => rows[0]?.total ?? 0);
	}
};

// ============================================================================
// Category Queries
// ============================================================================

export const categoryQueries = {
	/**
	 * Get all categories for a user
	 */
	findAll(db: SQLiteDb, userId: string) {
		return db.query.category.findMany({
			where: (categories, { eq }) => eq(categories.userId, userId),
			orderBy: (categories, { asc }) => [asc(categories.code)]
		});
	},

	/**
	 * Get category by ID
	 */
	findById(db: SQLiteDb, userId: string, categoryId: string) {
		return db.query.category.findFirst({
			where: (categories, { eq }) =>
				and(eq(categories.userId, userId), eq(categories.id, categoryId))
		});
	},

	/**
	 * Get category by code
	 */
	findByCode(db: SQLiteDb, userId: string, code: string) {
		return db.query.category.findFirst({
			where: (categories, { eq }) => and(eq(categories.userId, userId), eq(categories.code, code))
		});
	},

	/**
	 * Get categories by type (income/expense)
	 */
	findByType(db: SQLiteDb, userId: string, type: 'income' | 'expense') {
		return db.query.category.findMany({
			where: (categories, { eq }) => and(eq(categories.userId, userId), eq(categories.type, type)),
			orderBy: (categories, { asc }) => [asc(categories.code)]
		});
	},

	/**
	 * Create new category
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			code: string;
			name: string;
			type: 'income' | 'expense';
			icon?: string;
			color?: string;
		}
	) {
		return db
			.insert(category)
			.values({
				id: crypto.randomUUID(),
				userId: data.userId,
				code: data.code,
				name: data.name,
				type: data.type,
				isSystem: false,
				isActive: true,
				icon: data.icon ?? null,
				color: data.color ?? null
			})
			.returning()
			.then((rows) => rows[0]);
	},

	/**
	 * Update category
	 */
	update(
		db: SQLiteDb,
		userId: string,
		categoryId: string,
		data: {
			name?: string;
			code?: string;
			icon?: string;
			color?: string;
			isActive?: boolean;
		}
	) {
		return db
			.update(category)
			.set(data)
			.where(and(eq(category.userId, userId), eq(category.id, categoryId)));
	},

	/**
	 * Delete category
	 */
	delete(db: SQLiteDb, userId: string, categoryId: string) {
		return db.delete(category).where(and(eq(category.userId, userId), eq(category.id, categoryId)));
	},

	/**
	 * Generate next available code for a category type
	 * Income: 4xxx, Expense: 5xxx-8xxx
	 */
	generateNextCode(db: SQLiteDb, userId: string, type: 'income' | 'expense') {
		const baseCode = type === 'income' ? 4000 : 5000;
		return this.findByType(db, userId, type).then((categories) => {
			const maxCode = categories.reduce((max, cat) => {
				const codeNum = parseInt(cat.code, 10);
				return codeNum > max ? codeNum : max;
			}, baseCode);
			return String(maxCode + 1);
		});
	}
};

// ============================================================================
// Transaction Queries
// ============================================================================

export interface TransactionListOptions {
	limit?: number;
	offset?: number;
	accountId?: string;
	categoryId?: string;
	type?: 'income' | 'expense' | 'transfer';
	startDate?: string;
	endDate?: string;
	search?: string;
	sortBy?: 'date' | 'amount';
	sortOrder?: 'asc' | 'desc';
	includeInactive?: boolean;
}

function getTransactionListConditions(
	db: SQLiteDb,
	userId: string,
	options?: TransactionListOptions
) {
	const conditions = [eq(transaction.userId, userId)];

	if (!options?.includeInactive) conditions.push(eq(transaction.isActive, true));
	if (options?.accountId) conditions.push(eq(transaction.accountId, options.accountId));
	if (options?.categoryId) conditions.push(eq(transaction.categoryId, options.categoryId));
	// Transfers are stored as an expense leg and an income leg linked by toAccountId,
	// never as type 'transfer', so the filter matches the link and keeps the legs out
	// of the income and expense filters.
	if (options?.type === 'transfer') conditions.push(isNotNull(transaction.toAccountId));
	else if (options?.type) {
		conditions.push(eq(transaction.type, options.type), isNull(transaction.toAccountId));
	}
	if (options?.startDate) conditions.push(gte(transaction.date, options.startDate));
	if (options?.endDate) conditions.push(lte(transaction.date, options.endDate));

	const search = options?.search?.replace(/[%_]/g, '').trim();
	if (search) {
		const pattern = `%${search}%`;
		const matchingCategoryIds = db
			.select({ id: category.id })
			.from(category)
			.where(and(eq(category.userId, userId), like(category.name, pattern)));
		const matchingAccountIds = db
			.select({ id: chartOfAccount.id })
			.from(chartOfAccount)
			.where(and(eq(chartOfAccount.userId, userId), like(chartOfAccount.name, pattern)));

		conditions.push(
			or(
				like(transaction.description, pattern),
				like(transaction.referenceNumber, pattern),
				like(transaction.notes, pattern),
				inArray(transaction.categoryId, matchingCategoryIds),
				inArray(transaction.accountId, matchingAccountIds),
				inArray(transaction.toAccountId, matchingAccountIds)
			)!
		);
	}

	return conditions;
}

function getTransactionOrder(options?: TransactionListOptions) {
	const direction = options?.sortOrder === 'asc' ? asc : desc;
	if (options?.sortBy === 'amount') {
		return [direction(transaction.amount), desc(transaction.date), desc(transaction.createdAt)];
	}
	return [direction(transaction.date), direction(transaction.createdAt), direction(transaction.id)];
}

export const transactionQueries = {
	/**
	 * Get all transactions for a user with pagination
	 */
	findAll(db: SQLiteDb, userId: string, options?: TransactionListOptions) {
		const conditions = getTransactionListConditions(db, userId, options);

		return db.query.transaction.findMany({
			where: and(...conditions),
			orderBy: getTransactionOrder(options),
			limit: options?.limit ?? 50,
			offset: options?.offset ?? 0,
			with: {
				account: true,
				category: true,
				toAccount: true
			}
		});
	},

	async count(db: SQLiteDb, userId: string, options?: TransactionListOptions) {
		const [result] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(transaction)
			.where(and(...getTransactionListConditions(db, userId, options)));
		return Number(result?.count ?? 0);
	},

	findForExport(db: SQLiteDb, userId: string, options?: TransactionListOptions) {
		const conditions = getTransactionListConditions(db, userId, options);
		return db.query.transaction.findMany({
			where: and(...conditions),
			orderBy: getTransactionOrder(options),
			with: {
				account: true,
				category: true,
				toAccount: true
			}
		});
	},

	/**
	 * Get transaction by ID
	 */
	findById(db: SQLiteDb, userId: string, transactionId: string, includeInactive = false) {
		return db.query.transaction.findFirst({
			where: (transactions, { eq, and }) =>
				and(
					eq(transactions.userId, userId),
					eq(transactions.id, transactionId),
					includeInactive ? undefined : eq(transactions.isActive, true)
				),
			with: {
				account: true,
				category: true,
				toAccount: true
			}
		});
	},

	/**
	 * Create new transaction
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			date: string;
			type: 'income' | 'expense' | 'transfer';
			amount: number;
			description?: string;
			accountId: string;
			toAccountId?: string;
			categoryId?: string;
			debtId?: string;
			isTaxed?: boolean;
			taxAmount?: number;
			referenceNumber?: string;
			notes?: string;
		}
	) {
		return db.insert(transaction).values({
			id: crypto.randomUUID(),
			userId: data.userId,
			date: data.date,
			type: data.type,
			amount: data.amount,
			description: data.description ?? null,
			accountId: data.accountId,
			toAccountId: data.toAccountId ?? null,
			categoryId: data.categoryId ?? null,
			debtId: data.debtId ?? null,
			isTaxed: data.isTaxed ?? false,
			taxAmount: data.taxAmount ?? 0,
			referenceNumber: data.referenceNumber ?? null,
			notes: data.notes ?? null
		});
	},

	/**
	 * Update transaction
	 */
	update(
		db: SQLiteDb,
		userId: string,
		transactionId: string,
		data: {
			date?: string;
			amount?: number;
			description?: string;
			categoryId?: string;
			referenceNumber?: string;
			notes?: string;
		}
	) {
		return db
			.update(transaction)
			.set(data)
			.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));
	},

	/**
	 * Delete transaction
	 */
	delete(db: SQLiteDb, userId: string, transactionId: string) {
		return db
			.delete(transaction)
			.where(and(eq(transaction.userId, userId), eq(transaction.id, transactionId)));
	},

	/**
	 * Get recent transactions
	 */
	getRecent(db: SQLiteDb, userId: string, limit = 10) {
		return db.query.transaction.findMany({
			where: (transactions, { eq }) =>
				and(eq(transactions.userId, userId), eq(transactions.isActive, true)),
			orderBy: (transactions, { desc }) => [desc(transactions.date), desc(transactions.createdAt)],
			limit,
			with: {
				account: true,
				category: true
			}
		});
	},

	/**
	 * True when the category's owner has any transaction, active or deleted, in it. Rows are
	 * matched on userId as well as categoryId, so another user's row pointing at this
	 * category never counts. Callers check that the category belongs to the signed-in
	 * user before asking.
	 */
	async hasTransactionsByCategory(db: SQLiteDb, categoryId: string): Promise<boolean> {
		const rows = await db
			.select({ id: transaction.id })
			.from(transaction)
			.innerJoin(
				category,
				and(eq(category.id, transaction.categoryId), eq(category.userId, transaction.userId))
			)
			.where(eq(transaction.categoryId, categoryId))
			.limit(1);
		return rows.length > 0;
	}
};

// ============================================================================
// Debt Queries (Piutang/Hutang)
// ============================================================================

interface DebtListOptions {
	type?: 'piutang' | 'hutang';
	status?: 'active' | 'paid' | 'overdue';
	includeInactive?: boolean;
}

function getDebtListConditions(userId: string, options?: DebtListOptions) {
	const conditions = [eq(debt.userId, userId)];

	if (!options?.includeInactive) {
		conditions.push(eq(debt.isActive, true));
	}
	if (options?.type) {
		conditions.push(eq(debt.type, options.type));
	}
	if (options?.status) {
		conditions.push(eq(debt.status, options.status));
	}

	return conditions;
}

export const debtQueries = {
	/**
	 * Get all debts for a user
	 */
	findAll(db: SQLiteDb, userId: string, options?: DebtListOptions) {
		const conditions = getDebtListConditions(userId, options);
		return db.query.debt.findMany({
			where: and(...conditions),
			orderBy: (debts, { desc }) => [desc(debts.createdAt)],
			with: {
				payments: true
			}
		});
	},

	/**
	 * Get debt rows without payment history for summaries and backups.
	 */
	findAllSummaries(db: SQLiteDb, userId: string, options?: DebtListOptions) {
		const conditions = getDebtListConditions(userId, options);
		return db.query.debt.findMany({
			where: and(...conditions),
			orderBy: (debts, { desc }) => [desc(debts.createdAt)]
		});
	},

	/**
	 * Get debt by ID
	 */
	findById(db: SQLiteDb, userId: string, debtId: string, options?: { includeInactive?: boolean }) {
		// By default, only return active debts
		const isActiveCondition = options?.includeInactive ? undefined : eq(debt.isActive, true);

		return db.query.debt.findFirst({
			where: (debts, { eq }) =>
				and(eq(debts.userId, userId), eq(debts.id, debtId), isActiveCondition),
			with: {
				payments: {
					orderBy: (payments, { asc }) => [asc(payments.date)]
				}
			}
		});
	},

	/**
	 * Create new debt
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			type: 'piutang' | 'hutang';
			contactName: string;
			contactPhone?: string;
			contactAddress?: string;
			originalAmount: number;
			date: string;
			dueDate?: string;
			description?: string;
		}
	) {
		return db.insert(debt).values({
			id: crypto.randomUUID(),
			userId: data.userId,
			type: data.type,
			contactName: data.contactName,
			contactPhone: data.contactPhone ?? null,
			contactAddress: data.contactAddress ?? null,
			originalAmount: data.originalAmount,
			paidAmount: 0,
			remainingAmount: data.originalAmount,
			date: data.date,
			dueDate: data.dueDate ?? null,
			description: data.description ?? null,
			status: 'active'
			// isActive defaults to true in schema
		});
	},

	/**
	 * Update debt
	 */
	update(
		db: SQLiteDb,
		userId: string,
		debtId: string,
		data: {
			contactName?: string;
			contactPhone?: string | null;
			contactAddress?: string | null;
			dueDate?: string | null;
			description?: string | null;
		}
	) {
		const updateData: Record<string, unknown> = {};

		if (data.contactName !== undefined) {
			updateData.contactName = data.contactName;
		}
		if (data.contactPhone !== undefined) {
			updateData.contactPhone = data.contactPhone;
		}
		if (data.contactAddress !== undefined) {
			updateData.contactAddress = data.contactAddress;
		}
		if (data.dueDate !== undefined) {
			updateData.dueDate = data.dueDate;
		}
		if (data.description !== undefined) {
			updateData.description = data.description;
		}

		return db
			.update(debt)
			.set(updateData)
			.where(and(eq(debt.userId, userId), eq(debt.id, debtId)));
	},

	/**
	 * Delete debt (soft delete)
	 */
	delete(db: SQLiteDb, userId: string, debtId: string) {
		return db
			.update(debt)
			.set({ isActive: false })
			.where(and(eq(debt.userId, userId), eq(debt.id, debtId)));
	},

	/**
	 * Get debt summary
	 */
	getSummary(db: SQLiteDb, userId: string) {
		return db
			.select({
				type: debt.type,
				totalOriginal: sql`SUM(${debt.originalAmount})`,
				totalPaid: sql`SUM(${debt.paidAmount})`,
				totalRemaining: sql`SUM(${debt.remainingAmount})`,
				count: sql`COUNT(*)`
			})
			.from(debt)
			.where(and(eq(debt.userId, userId), eq(debt.isActive, true)))
			.groupBy(debt.type);
	}
};

// ============================================================================
// Tax Record Queries
// ============================================================================

export const taxRecordQueries = {
	/**
	 * Get all tax records for a user
	 */
	findAll(
		db: SQLiteDb,
		userId: string,
		options?: {
			year?: number;
			month?: number;
			status?: 'unpaid' | 'paid' | 'overdue';
		}
	) {
		const conditions = [eq(taxRecord.userId, userId)];

		if (options?.year) {
			conditions.push(eq(taxRecord.year, options.year));
		}
		if (options?.month) {
			conditions.push(eq(taxRecord.month, options.month));
		}
		if (options?.status) {
			conditions.push(eq(taxRecord.status, options.status));
		}

		return db.query.taxRecord.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			orderBy: (records, { desc }) => [desc(records.year), desc(records.month)]
		});
	},

	/**
	 * Get tax record by ID
	 */
	findById(db: SQLiteDb, userId: string, taxId: string) {
		return db.query.taxRecord.findFirst({
			where: (records, { eq }) => and(eq(records.userId, userId), eq(records.id, taxId))
		});
	},

	/**
	 * Get tax record by year/month
	 */
	findByPeriod(db: SQLiteDb, userId: string, year: number, month?: number) {
		return db.query.taxRecord.findFirst({
			where: (records, { eq, isNull }) =>
				and(
					eq(records.userId, userId),
					eq(records.year, year),
					month ? eq(records.month, month) : isNull(records.month)
				)
		});
	},

	/**
	 * Create tax record
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			year: number;
			month?: number;
			taxType: string;
			taxableIncome: number;
			taxRate: number;
			taxAmount: number;
		}
	) {
		return db.insert(taxRecord).values({
			id: crypto.randomUUID(),
			userId: data.userId,
			year: data.year,
			month: data.month ?? null,
			taxType: data.taxType,
			taxableIncome: data.taxableIncome,
			taxRate: data.taxRate,
			taxAmount: data.taxAmount,
			status: 'unpaid'
		});
	},

	/**
	 * Update tax record status
	 */
	updateStatus(
		db: SQLiteDb,
		userId: string,
		taxId: string,
		data: {
			status?: 'unpaid' | 'paid' | 'overdue';
			billingCode?: string;
			paymentDate?: string;
			notes?: string;
		}
	) {
		return db
			.update(taxRecord)
			.set(data)
			.where(and(eq(taxRecord.userId, userId), eq(taxRecord.id, taxId)));
	},

	/**
	 * Get tax summary for year
	 */
	getYearSummary(db: SQLiteDb, userId: string, year: number) {
		return db
			.select({
				status: taxRecord.status,
				totalTaxable: sql`SUM(${taxRecord.taxableIncome})`,
				totalTax: sql`SUM(${taxRecord.taxAmount})`,
				count: sql`COUNT(*)`
			})
			.from(taxRecord)
			.where(and(eq(taxRecord.userId, userId), eq(taxRecord.year, year)))
			.groupBy(taxRecord.status);
	},

	/**
	 * Delete tax record
	 */
	delete(db: SQLiteDb, userId: string, taxId: string) {
		return db.delete(taxRecord).where(and(eq(taxRecord.userId, userId), eq(taxRecord.id, taxId)));
	}
};

// ============================================================================
// Business Profile Queries
// ============================================================================

export const businessProfileQueries = {
	/**
	 * Get business profile for user
	 */
	findByUserId(db: SQLiteDb, userId: string) {
		return db.query.businessProfile.findFirst({
			where: (profiles, { eq }) => eq(profiles.userId, userId)
		});
	},

	/**
	 * Create business profile
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			name: string;
			businessType: string;
			address?: string;
			phone?: string;
			npwp?: string;
			ownerName?: string;
			industry?: string;
		}
	) {
		return db.insert(businessProfile).values({
			id: crypto.randomUUID(),
			userId: data.userId,
			name: data.name,
			businessType: data.businessType,
			address: data.address ?? null,
			phone: data.phone ?? null,
			npwp: data.npwp ?? null,
			ownerName: data.ownerName ?? null,
			industry: data.industry ?? null
		});
	},

	/**
	 * Update business profile
	 */
	update(
		db: SQLiteDb,
		userId: string,
		data: {
			name?: string;
			businessType?: string;
			address?: string | null;
			phone?: string | null;
			npwp?: string | null;
			ownerName?: string | null;
			industry?: string | null;
		}
	) {
		return db.update(businessProfile).set(data).where(eq(businessProfile.userId, userId));
	}
};

// ============================================================================
// Dashboard Aggregation Queries
// ============================================================================

export const dashboardQueries = {
	/**
	 * Load the dashboard's shared aggregates with one statement per table.
	 * This keeps the page/API contract while avoiding repeated scans and serial D1 round trips.
	 */
	async getOverview(
		db: SQLiteDb,
		userId: string,
		period: 'daily' | 'weekly' | 'monthly' = 'monthly',
		today = todayInJakarta()
	) {
		const day = reportPeriodRanges('daily', today).current;
		const month = reportPeriodRanges('monthly', today).current;
		const year = reportPeriodRanges('yearly', today).current;
		const selected = reportPeriodRanges(period, today).current;
		// Every column needs its own alias: Drizzle maps D1 batch rows by column name, and
		// unaliased sums with identical SQL text collapse into one key, shifting every later
		// value into the wrong field.
		const accountQuery = db
			.select({
				assets:
					sql<number>`COALESCE(SUM(CASE WHEN ${chartOfAccount.type} = 'asset' THEN ${chartOfAccount.balance} ELSE 0 END), 0)`.as(
						'assets'
					),
				liabilities:
					sql<number>`COALESCE(SUM(CASE WHEN ${chartOfAccount.type} = 'liability' THEN ${chartOfAccount.balance} ELSE 0 END), 0)`.as(
						'liabilities'
					),
				equity:
					sql<number>`COALESCE(SUM(CASE WHEN ${chartOfAccount.type} = 'equity' THEN ${chartOfAccount.balance} ELSE 0 END), 0)`.as(
						'equity'
					)
			})
			.from(chartOfAccount)
			// Inactive accounts count too, as on the balance sheet: deactivation hides an
			// account from new entries but never takes its balance out of the books.
			.where(eq(chartOfAccount.userId, userId));
		const profitAndLoss = profitAndLossTotals(db, userId, {
			month,
			year,
			today: day,
			period: selected
		});
		const debtQuery = db
			.select({
				// Outstanding means a remaining amount, as on the balance sheet.
				piutang:
					sql<number>`COALESCE(SUM(CASE WHEN ${debt.type} = 'piutang' AND ${debt.remainingAmount} > 0 THEN ${debt.remainingAmount} ELSE 0 END), 0)`.as(
						'piutang'
					),
				hutang:
					sql<number>`COALESCE(SUM(CASE WHEN ${debt.type} = 'hutang' AND ${debt.remainingAmount} > 0 THEN ${debt.remainingAmount} ELSE 0 END), 0)`.as(
						'hutang'
					),
				activeCount:
					sql<number>`COALESCE(SUM(CASE WHEN ${debt.remainingAmount} > 0 THEN 1 ELSE 0 END), 0)`.as(
						'active_count'
					)
			})
			.from(debt)
			// A deleted debt (isActive = false) no longer exists, whatever its status says.
			.where(and(eq(debt.userId, userId), eq(debt.isActive, true)));
		const taxQuery = db
			.select({ count: sql<number>`COUNT(*)`.as('count') })
			.from(taxRecord)
			.where(and(eq(taxRecord.userId, userId), eq(taxRecord.status, 'unpaid')));

		// D1 processes a batch through one connection and returns results in order,
		// keeping the dashboard below the per-invocation connection limit.
		const [accountRows, transactionTotals, tradeDebtTotals, debtRows, taxRows] = await db.batch([
			accountQuery,
			profitAndLoss.transactions,
			profitAndLoss.tradeDebts,
			debtQuery,
			taxQuery
		]);

		const accounts = accountRows[0];
		const debts = debtRows[0];
		const totals = profitAndLoss.read(transactionTotals, tradeDebtTotals);
		const totalAssets = Number(accounts?.assets ?? 0);
		const totalLiabilities = Number(accounts?.liabilities ?? 0);
		const totalEquity = Number(accounts?.equity ?? 0);
		const piutang = Number(debts?.piutang ?? 0);
		const hutang = Number(debts?.hutang ?? 0);

		return {
			summary: {
				totalAssets,
				totalLiabilities,
				totalEquity,
				// Receivables and payables live in the debt table, not in accounts. Counted the
				// balance sheet's way, net worth equals its equity.
				netWorth: totalAssets + piutang - hutang - totalLiabilities,
				monthlyIncome: totals.month.income,
				monthlyExpense: totals.month.expense,
				monthlyProfit: totals.month.profit,
				yearToDateRevenue: totals.year.income,
				yearToDateExpense: totals.year.expense,
				yearToDateProfit: totals.year.profit,
				activeDebtsCount: Number(debts?.activeCount ?? 0),
				unpaidTaxesCount: Number(taxRows[0]?.count ?? 0)
			},
			periodStats: {
				period,
				startDate: selected.start,
				endDate: selected.end,
				...totals.period
			},
			todayStats: totals.today,
			debtSummary: { piutang, hutang }
		};
	},

	/**
	 * Get cash flow data for chart
	 */
	async getCashFlow(db: SQLiteDb, userId: string, months = 6, today = todayInJakarta()) {
		const monthCount = Math.max(0, Math.floor(months));
		if (monthCount === 0) return [];

		// Month arithmetic in UTC on the Jakarta calendar month, independent of server time.
		const [currentYear, currentMonth] = today.split('-').map(Number);
		const monthStart = (offset: number) =>
			new Date(Date.UTC(currentYear, currentMonth - 1 + offset, 1));
		const toDateString = (date: Date) => date.toISOString().slice(0, 10);
		const firstMonth = monthStart(1 - monthCount);
		const monthAfterLast = monthStart(1);
		const monthExpression = sql<string>`substr(${transaction.date}, 1, 7)`;

		const rows = await db
			.select({
				label: monthExpression,
				type: transaction.type,
				total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)`
			})
			.from(transaction)
			.where(
				and(
					eq(transaction.userId, userId),
					cashMovementRows(),
					inArray(transaction.type, ['income', 'expense']),
					gte(transaction.date, toDateString(firstMonth)),
					lt(transaction.date, toDateString(monthAfterLast))
				)
			)
			.groupBy(monthExpression, transaction.type);

		const totals = new Map<string, { income: number; expense: number }>();
		for (const row of rows) {
			const current = totals.get(row.label) ?? { income: 0, expense: 0 };
			if (row.type === 'income') current.income = Number(row.total);
			if (row.type === 'expense') current.expense = Number(row.total);
			totals.set(row.label, current);
		}

		return Array.from({ length: monthCount }, (_, index) => {
			const date = monthStart(index + 1 - monthCount);
			const year = date.getUTCFullYear();
			const month = date.getUTCMonth() + 1;
			const label = `${year}-${String(month).padStart(2, '0')}`;
			const total = totals.get(label) ?? { income: 0, expense: 0 };

			return {
				year,
				month,
				label,
				income: total.income,
				expense: total.expense,
				net: total.income - total.expense
			};
		});
	},

	/**
	 * Revenue and expense by category for the period containing `today`, plus one line
	 * each for credit sales and credit purchases.
	 */
	getProfitLossByCategory(
		db: SQLiteDb,
		userId: string,
		period: ReportPeriod = 'monthly',
		today = todayInJakarta()
	) {
		const { start: startDate, end: endDate } = reportPeriodRanges(period, today).current;

		const byCategory = (type: 'income' | 'expense') =>
			db
				.select({
					categoryId: transaction.categoryId,
					categoryCode: category.code,
					categoryName: category.name,
					categoryColor: category.color,
					total: sql<number>`COALESCE(SUM(${transaction.amount}), 0)`
				})
				.from(transaction)
				.leftJoin(
					category,
					and(eq(transaction.categoryId, category.id), eq(category.userId, transaction.userId))
				)
				.where(
					and(
						eq(transaction.userId, userId),
						eq(transaction.type, type),
						profitAndLossRows(),
						gte(transaction.date, startDate),
						lt(transaction.date, endDate)
					)
				)
				.groupBy(transaction.categoryId);
		// Credit sales and purchases have no category, so each gets its own line.
		const creditTotals = db
			.select({
				type: debt.type,
				total: sql<number>`COALESCE(SUM(${debt.originalAmount}), 0)`
			})
			.from(debt)
			.where(
				and(
					eq(debt.userId, userId),
					tradeDebtRows(),
					gte(debt.date, startDate),
					lt(debt.date, endDate)
				)
			)
			.groupBy(debt.type);

		return (async () => {
			const [incomeByCategory, expenseByCategory, credit] = await Promise.all([
				byCategory('income'),
				byCategory('expense'),
				creditTotals
			]);
			const creditTotal = (type: 'piutang' | 'hutang') =>
				Number(credit.find((row) => row.type === type)?.total ?? 0);
			const creditLine = (id: string, name: string, color: string, total: number) =>
				total > 0
					? [{ categoryId: id, categoryCode: '', categoryName: name, categoryColor: color, total }]
					: [];

			return {
				income: [
					...incomeByCategory.map((row) => ({
						categoryId: row.categoryId ?? '',
						categoryCode: row.categoryCode ?? '',
						categoryName: row.categoryName ?? 'Tanpa Kategori',
						categoryColor: row.categoryColor ?? '#22c55e',
						total: Number(row.total)
					})),
					...creditLine('credit-sales', CREDIT_SALES_LABEL, '#16a34a', creditTotal('piutang'))
				],
				expense: [
					...expenseByCategory.map((row) => ({
						categoryId: row.categoryId ?? '',
						categoryCode: row.categoryCode ?? '',
						categoryName: row.categoryName ?? 'Tanpa Kategori',
						categoryColor: row.categoryColor ?? '#ef4444',
						total: Number(row.total)
					})),
					...creditLine(
						'credit-purchases',
						CREDIT_PURCHASES_LABEL,
						'#dc2626',
						creditTotal('hutang')
					)
				]
			};
		})();
	},

	/**
	 * Accrual totals for the period containing `today` and the period before it.
	 */
	getPreviousPeriodStats(
		db: SQLiteDb,
		userId: string,
		period: ReportPeriod = 'monthly',
		today = todayInJakarta()
	) {
		const totals = profitAndLossTotals(db, userId, reportPeriodRanges(period, today));
		return (async () => {
			const [transactionRows, tradeDebtTotals] = await db.batch([
				totals.transactions,
				totals.tradeDebts
			]);
			return totals.read(transactionRows, tradeDebtTotals);
		})();
	}
};

// ============================================================================
// Transaction Photo Queries
// ============================================================================

export const transactionPhotoQueries = {
	/**
	 * Get all photos for a transaction
	 */
	findByTransactionId(db: SQLiteDb, userId: string, transactionId: string) {
		return db.query.transactionPhoto.findMany({
			where: (photos, { eq, and }) =>
				and(eq(photos.userId, userId), eq(photos.transactionId, transactionId)),
			orderBy: (photos, { asc }) => [asc(photos.createdAt)]
		});
	},

	/**
	 * Get photo by ID
	 */
	findById(db: SQLiteDb, userId: string, photoId: string) {
		return db.query.transactionPhoto.findFirst({
			where: (photos, { eq, and }) => and(eq(photos.userId, userId), eq(photos.id, photoId))
		});
	},

	/**
	 * Count photos for a transaction
	 */
	countByTransactionId(db: SQLiteDb, userId: string, transactionId: string) {
		return db
			.select({ count: sql`COUNT(*)` })
			.from(transactionPhoto)
			.where(
				and(eq(transactionPhoto.userId, userId), eq(transactionPhoto.transactionId, transactionId))
			)
			.then((rows) => Number(rows[0]?.count ?? 0));
	},

	/**
	 * Create transaction photo
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			transactionId: string;
			fileName: string;
			fileSize: number;
			mimeType: string;
			r2Key: string;
			r2Url?: string;
			caption?: string;
		}
	) {
		return db
			.insert(transactionPhoto)
			.values({
				id: crypto.randomUUID(),
				userId: data.userId,
				transactionId: data.transactionId,
				fileName: data.fileName,
				fileSize: data.fileSize,
				mimeType: data.mimeType,
				r2Key: data.r2Key,
				r2Url: data.r2Url ?? null,
				caption: data.caption ?? null
			})
			.returning()
			.then((rows) => rows[0]);
	},

	/**
	 * Update photo caption
	 */
	updateCaption(db: SQLiteDb, userId: string, photoId: string, caption: string) {
		return db
			.update(transactionPhoto)
			.set({ caption })
			.where(and(eq(transactionPhoto.userId, userId), eq(transactionPhoto.id, photoId)));
	},

	/**
	 * Delete transaction photo
	 */
	delete(db: SQLiteDb, userId: string, photoId: string) {
		return db
			.delete(transactionPhoto)
			.where(and(eq(transactionPhoto.userId, userId), eq(transactionPhoto.id, photoId)));
	}
};

// ============================================================================
// Transaction Template Queries
// ============================================================================

export const transactionTemplateQueries = {
	/**
	 * Get all templates for a user (system + custom)
	 */
	findAll(db: SQLiteDb, userId: string) {
		return db.query.transactionTemplate.findMany({
			where: (templates, { eq }) => eq(templates.userId, userId),
			orderBy: (templates, { asc }) => [asc(templates.isSystem), asc(templates.name)]
		});
	},

	/**
	 * Get all active templates for a user
	 */
	findAllActive(db: SQLiteDb, userId: string) {
		return db.query.transactionTemplate.findMany({
			where: (templates, { eq, and }) =>
				and(eq(templates.userId, userId), eq(templates.isActive, true)),
			orderBy: (templates, { asc }) => [asc(templates.isSystem), asc(templates.name)]
		});
	},

	/**
	 * Get template by ID
	 */
	findById(db: SQLiteDb, userId: string, templateId: string) {
		return db.query.transactionTemplate.findFirst({
			where: (templates, { eq, and }) =>
				and(eq(templates.userId, userId), eq(templates.id, templateId))
		});
	},

	/**
	 * Get templates by type (income/expense)
	 */
	findByType(db: SQLiteDb, userId: string, type: 'income' | 'expense') {
		return db.query.transactionTemplate.findMany({
			where: (templates, { eq, and }) =>
				and(eq(templates.userId, userId), eq(templates.type, type), eq(templates.isActive, true)),
			orderBy: (templates, { asc }) => [asc(templates.isSystem), asc(templates.name)]
		});
	},

	/**
	 * Create new template
	 */
	create(
		db: SQLiteDb,
		data: {
			userId: string;
			name: string;
			type: 'income' | 'expense';
			categoryId?: string;
			description?: string;
			isSystem?: boolean;
		}
	) {
		return db
			.insert(transactionTemplate)
			.values({
				id: crypto.randomUUID(),
				userId: data.userId,
				name: data.name,
				type: data.type,
				categoryId: data.categoryId ?? null,
				description: data.description ?? null,
				isSystem: data.isSystem ?? false,
				isActive: true
			})
			.returning()
			.then((rows) => rows[0]);
	},

	/**
	 * Update template
	 */
	update(
		db: SQLiteDb,
		userId: string,
		templateId: string,
		data: {
			name?: string;
			type?: 'income' | 'expense';
			categoryId?: string | null;
			description?: string | null;
			isActive?: boolean;
		}
	) {
		return db
			.update(transactionTemplate)
			.set(data)
			.where(and(eq(transactionTemplate.userId, userId), eq(transactionTemplate.id, templateId)));
	},

	/**
	 * Delete template (only non-system templates can be deleted)
	 */
	delete(db: SQLiteDb, userId: string, templateId: string) {
		return db
			.delete(transactionTemplate)
			.where(and(eq(transactionTemplate.userId, userId), eq(transactionTemplate.id, templateId)));
	},

	/**
	 * Check if template exists and belongs to user
	 */
	exists(db: SQLiteDb, userId: string, templateId: string) {
		return db
			.select({ id: transactionTemplate.id })
			.from(transactionTemplate)
			.where(and(eq(transactionTemplate.userId, userId), eq(transactionTemplate.id, templateId)))
			.then((rows) => rows.length > 0);
	},

	/**
	 * Count templates by type
	 */
	countByType(db: SQLiteDb, userId: string, type: 'income' | 'expense') {
		return db
			.select({ count: sql`COUNT(*)` })
			.from(transactionTemplate)
			.where(and(eq(transactionTemplate.userId, userId), eq(transactionTemplate.type, type)))
			.then((rows) => Number(rows[0]?.count ?? 0));
	}
};

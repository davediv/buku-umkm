import { eq, and, gte, lte, lt, sql } from 'drizzle-orm';
import type { SQLiteDb } from '../index';
import {
	chartOfAccount,
	category,
	transaction,
	debt,
	debtPayment,
	taxRecord,
	businessProfile,
	transactionPhoto
} from '../schema';

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
			balance: 0
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
		return db.insert(category).values({
			id: crypto.randomUUID(),
			userId: data.userId,
			code: data.code,
			name: data.name,
			type: data.type,
			isSystem: false,
			isActive: true,
			icon: data.icon ?? null,
			color: data.color ?? null
		});
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

export const transactionQueries = {
	/**
	 * Get all transactions for a user with pagination
	 */
	findAll(
		db: SQLiteDb,
		userId: string,
		options?: {
			limit?: number;
			offset?: number;
			accountId?: string;
			categoryId?: string;
			type?: 'income' | 'expense' | 'transfer';
			startDate?: string;
			endDate?: string;
			includeInactive?: boolean;
		}
	) {
		const conditions = [eq(transaction.userId, userId)];

		// Default to only active transactions
		if (!options?.includeInactive) {
			conditions.push(eq(transaction.isActive, true));
		}

		if (options?.accountId) {
			conditions.push(eq(transaction.accountId, options.accountId));
		}
		if (options?.categoryId) {
			conditions.push(eq(transaction.categoryId, options.categoryId));
		}
		if (options?.type) {
			conditions.push(eq(transaction.type, options.type));
		}
		if (options?.startDate) {
			conditions.push(gte(transaction.date, options.startDate));
		}
		if (options?.endDate) {
			conditions.push(lte(transaction.date, options.endDate));
		}

		return db.query.transaction.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			orderBy: (transactions, { desc }) => [desc(transactions.date), desc(transactions.createdAt)],
			limit: options?.limit ?? 50,
			offset: options?.offset ?? 0,
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
	 * Get monthly totals
	 */
	getMonthlyTotals(db: SQLiteDb, userId: string, year: number, month: number) {
		const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
		const endDate =
			month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

		return db
			.select({
				type: transaction.type,
				total: sql`SUM(${transaction.amount})`
			})
			.from(transaction)
			.where(
				and(
					eq(transaction.userId, userId),
					gte(transaction.date, startDate),
					lt(transaction.date, endDate)
				)
			)
			.groupBy(transaction.type);
	},

	/**
	 * Get yearly totals
	 */
	getYearlyTotals(db: SQLiteDb, userId: string, year: number) {
		const startDate = `${year}-01-01`;
		const endDate = `${year + 1}-01-01`;

		return db
			.select({
				type: transaction.type,
				total: sql`SUM(${transaction.amount})`
			})
			.from(transaction)
			.where(
				and(
					eq(transaction.userId, userId),
					gte(transaction.date, startDate),
					lt(transaction.date, endDate)
				)
			)
			.groupBy(transaction.type);
	},

	/**
	 * Get recent transactions
	 */
	getRecent(db: SQLiteDb, userId: string, limit = 10) {
		return db.query.transaction.findMany({
			where: (transactions, { eq }) => eq(transactions.userId, userId),
			orderBy: (transactions, { desc }) => [desc(transactions.date), desc(transactions.createdAt)],
			limit,
			with: {
				account: true,
				category: true
			}
		});
	},

	/**
	 * Check if category has transactions
	 */
	hasTransactionsByCategory(db: SQLiteDb, categoryId: string) {
		return db.query.transaction.findFirst({
			where: (transactions, { eq }) => eq(transactions.categoryId, categoryId)
		});
	}
};

// ============================================================================
// Debt Queries (Piutang/Hutang)
// ============================================================================

export const debtQueries = {
	/**
	 * Get all debts for a user
	 */
	findAll(
		db: SQLiteDb,
		userId: string,
		options?: {
			type?: 'piutang' | 'hutang';
			status?: 'active' | 'paid' | 'overdue';
		}
	) {
		const conditions = [eq(debt.userId, userId)];

		if (options?.type) {
			conditions.push(eq(debt.type, options.type));
		}
		if (options?.status) {
			conditions.push(eq(debt.status, options.status));
		}

		return db.query.debt.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			orderBy: (debts, { desc }) => [desc(debts.createdAt)],
			with: {
				payments: true
			}
		});
	},

	/**
	 * Get debt by ID
	 */
	findById(db: SQLiteDb, userId: string, debtId: string) {
		return db.query.debt.findFirst({
			where: (debts, { eq }) => and(eq(debts.userId, userId), eq(debts.id, debtId)),
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
		});
	},

	/**
	 * Record payment
	 */
	recordPayment(
		db: SQLiteDb,
		data: {
			debtId: string;
			userId: string;
			amount: number;
			date: string;
			accountId: string;
			transactionId?: string;
			notes?: string;
		}
	) {
		return db.transaction(async (tx) => {
			// Insert payment
			await tx.insert(debtPayment).values({
				id: crypto.randomUUID(),
				debtId: data.debtId,
				userId: data.userId,
				amount: data.amount,
				date: data.date,
				accountId: data.accountId,
				transactionId: data.transactionId ?? null,
				notes: data.notes ?? null
			});

			// Update debt remaining amount
			await tx
				.update(debt)
				.set({
					paidAmount: sql`${debt.paidAmount} + ${data.amount}`,
					remainingAmount: sql`${debt.remainingAmount} - ${data.amount}`,
					status: sql`CASE WHEN ${debt.remainingAmount} - ${data.amount} <= 0 THEN 'paid' ELSE ${debt.status} END`
				})
				.where(eq(debt.id, data.debtId));
		});
	},

	/**
	 * Delete debt
	 */
	delete(db: SQLiteDb, userId: string, debtId: string) {
		return db.delete(debt).where(and(eq(debt.userId, userId), eq(debt.id, debtId)));
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
			.where(eq(debt.userId, userId))
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
			address?: string;
			phone?: string;
			npwp?: string;
			ownerName?: string;
			industry?: string;
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
	 * Get dashboard summary
	 */
	getSummary(db: SQLiteDb, userId: string) {
		return db.transaction(async (tx) => {
			// Total assets
			const assets = await tx
				.select({
					total: sql`COALESCE(SUM(${chartOfAccount.balance}), 0)`
				})
				.from(chartOfAccount)
				.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.type, 'asset')))
				.then((rows) => Number(rows[0]?.total ?? 0));

			// Total liabilities
			const liabilities = await tx
				.select({
					total: sql`COALESCE(SUM(${chartOfAccount.balance}), 0)`
				})
				.from(chartOfAccount)
				.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.type, 'liability')))
				.then((rows) => Number(rows[0]?.total ?? 0));

			// Total equity
			const equity = await tx
				.select({
					total: sql`COALESCE(SUM(${chartOfAccount.balance}), 0)`
				})
				.from(chartOfAccount)
				.where(and(eq(chartOfAccount.userId, userId), eq(chartOfAccount.type, 'equity')))
				.then((rows) => Number(rows[0]?.total ?? 0));

			// This month income
			const now = new Date();
			const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
			const endOfMonth =
				now.getMonth() === 11
					? `${now.getFullYear() + 1}-01-01`
					: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

			const monthlyIncome = await tx
				.select({
					total: sql`COALESCE(SUM(${transaction.amount}), 0)`
				})
				.from(transaction)
				.where(
					and(
						eq(transaction.userId, userId),
						eq(transaction.type, 'income'),
						gte(transaction.date, startOfMonth),
						lt(transaction.date, endOfMonth)
					)
				)
				.then((rows) => Number(rows[0]?.total ?? 0));

			// This month expense
			const monthlyExpense = await tx
				.select({
					total: sql`COALESCE(SUM(${transaction.amount}), 0)`
				})
				.from(transaction)
				.where(
					and(
						eq(transaction.userId, userId),
						eq(transaction.type, 'expense'),
						gte(transaction.date, startOfMonth),
						lt(transaction.date, endOfMonth)
					)
				)
				.then((rows) => Number(rows[0]?.total ?? 0));

			// Year to date revenue
			const startOfYear = `${now.getFullYear()}-01-01`;
			const yearIncome = await tx
				.select({
					total: sql`COALESCE(SUM(${transaction.amount}), 0)`
				})
				.from(transaction)
				.where(
					and(
						eq(transaction.userId, userId),
						eq(transaction.type, 'income'),
						gte(transaction.date, startOfYear)
					)
				)
				.then((rows) => Number(rows[0]?.total ?? 0));

			const yearExpense = await tx
				.select({
					total: sql`COALESCE(SUM(${transaction.amount}), 0)`
				})
				.from(transaction)
				.where(
					and(
						eq(transaction.userId, userId),
						eq(transaction.type, 'expense'),
						gte(transaction.date, startOfYear)
					)
				)
				.then((rows) => Number(rows[0]?.total ?? 0));

			// Active debts count
			const activeDebts = await tx
				.select({ count: sql`COUNT(*)` })
				.from(debt)
				.where(and(eq(debt.userId, userId), eq(debt.status, 'active')))
				.then((rows) => Number(rows[0]?.count ?? 0));

			// Unpaid taxes
			const unpaidTaxes = await tx
				.select({ count: sql`COUNT(*)` })
				.from(taxRecord)
				.where(and(eq(taxRecord.userId, userId), eq(taxRecord.status, 'unpaid')))
				.then((rows) => Number(rows[0]?.count ?? 0));

			return {
				totalAssets: assets,
				totalLiabilities: liabilities,
				totalEquity: equity,
				netWorth: assets - liabilities,
				monthlyIncome,
				monthlyExpense,
				monthlyProfit: monthlyIncome - monthlyExpense,
				yearToDateRevenue: yearIncome,
				yearToDateExpense: yearExpense,
				yearToDateProfit: yearIncome - yearExpense,
				activeDebtsCount: activeDebts,
				unpaidTaxesCount: unpaidTaxes
			};
		});
	},

	/**
	 * Get cash flow data for chart
	 */
	getCashFlow(db: SQLiteDb, userId: string, months = 6) {
		return db.transaction(async (tx) => {
			const now = new Date();
			const results = [];

			for (let i = months - 1; i >= 0; i--) {
				const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
				const year = date.getFullYear();
				const month = date.getMonth() + 1;

				const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
				const endDate =
					month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

				const income = await tx
					.select({
						total: sql`COALESCE(SUM(${transaction.amount}), 0)`
					})
					.from(transaction)
					.where(
						and(
							eq(transaction.userId, userId),
							eq(transaction.type, 'income'),
							gte(transaction.date, startDate),
							lt(transaction.date, endDate)
						)
					)
					.then((rows) => Number(rows[0]?.total ?? 0));

				const expense = await tx
					.select({
						total: sql`COALESCE(SUM(${transaction.amount}), 0)`
					})
					.from(transaction)
					.where(
						and(
							eq(transaction.userId, userId),
							eq(transaction.type, 'expense'),
							gte(transaction.date, startDate),
							lt(transaction.date, endDate)
						)
					)
					.then((rows) => Number(rows[0]?.total ?? 0));

				results.push({
					year,
					month,
					label: `${year}-${String(month).padStart(2, '0')}`,
					income,
					expense,
					net: income - expense
				});
			}

			return results;
		});
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

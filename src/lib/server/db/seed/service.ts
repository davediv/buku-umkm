import type { SQLiteDb } from '../index';
import { chartOfAccount, category, transactionTemplate } from '../schema';
import type { BusinessType } from './accounts';
import { getAccountTemplate, getCategoryTemplate, getTransactionTemplate } from './accounts';

export type { BusinessType } from './accounts';

/**
 * Seed accounts and categories for a user based on business type
 * @param db - The database instance
 * @param userId - The user's ID
 * @param businessType - The business type template to use
 */
export async function seedUserAccounts(db: SQLiteDb, userId: string, businessType: BusinessType) {
	const accountTemplates = getAccountTemplate(businessType);
	const categoryTemplates = getCategoryTemplate(businessType);

	// Build insert values for accounts
	const accountValues = accountTemplates.map((acc) => ({
		id: crypto.randomUUID(),
		userId,
		code: acc.code,
		name: acc.name,
		type: acc.type,
		subType: acc.subType ?? null,
		isSystem: acc.isSystem,
		isActive: true,
		parentId: null as string | null,
		balance: 0
	}));

	await db.insert(chartOfAccount).values(accountValues);

	// Insert categories with their IDs for reference
	const categoryIdMap = new Map<string, string>();
	const categoryValues = categoryTemplates.map((cat) => {
		const catId = crypto.randomUUID();
		categoryIdMap.set(cat.name, catId);
		return {
			id: catId,
			userId,
			code: cat.code,
			name: cat.name,
			type: cat.type,
			isSystem: cat.isSystem,
			isActive: true,
			icon: cat.icon ?? null,
			color: cat.color ?? null
		};
	});

	await db.insert(category).values(categoryValues);

	// Seed transaction templates based on business type
	const templateData = getTransactionTemplate(businessType);
	const templateValues = templateData.map((tmpl) => {
		// Find matching category ID by name
		const categoryId = tmpl.categoryName ? categoryIdMap.get(tmpl.categoryName) : null;
		return {
			id: crypto.randomUUID(),
			userId,
			name: tmpl.name,
			type: tmpl.type,
			categoryId: categoryId ?? null,
			description: tmpl.description ?? null,
			isSystem: true,
			isActive: true
		};
	});

	await db.insert(transactionTemplate).values(templateValues);

	return {
		accountsInserted: accountValues.length,
		categoriesInserted: categoryValues.length,
		templatesInserted: templateValues.length
	};
}

/**
 * Seed default cash account for quick onboarding
 * @param db - The database instance
 * @param userId - The user's ID
 */
export async function seedDefaultCashAccount(db: SQLiteDb, userId: string) {
	const existingCash = await db.query.chartOfAccount.findFirst({
		where: (accounts, { eq }) => eq(accounts.userId, userId) && eq(accounts.code, '1101')
	});

	if (!existingCash) {
		await db.insert(chartOfAccount).values({
			id: crypto.randomUUID(),
			userId,
			code: '1101',
			name: 'Kas',
			type: 'asset',
			subType: 'kas',
			isSystem: true,
			isActive: true,
			parentId: null,
			balance: 0
		});
	}
}

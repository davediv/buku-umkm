import type { SQLiteDb } from '../index';
import { chartOfAccount, category } from '../schema';
import type { BusinessType } from './accounts';
import { getAccountTemplate, getCategoryTemplate } from './accounts';

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

	// Build insert values
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

	// Insert categories
	const categoryValues = categoryTemplates.map((cat) => ({
		id: crypto.randomUUID(),
		userId,
		code: cat.code,
		name: cat.name,
		type: cat.type,
		isSystem: cat.isSystem,
		isActive: true,
		icon: cat.icon ?? null,
		color: cat.color ?? null
	}));

	await db.insert(category).values(categoryValues);

	return {
		accountsInserted: accountValues.length,
		categoriesInserted: categoryValues.length
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

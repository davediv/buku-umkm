// Account type constants and mapping utilities
// Shared across client and server code

export const VALID_ACCOUNT_TYPES = ['cash', 'bank', 'ewallet'] as const;
export type AccountType = (typeof VALID_ACCOUNT_TYPES)[number];

// Map API type to schema values (type and subType)
export const ACCOUNT_TYPE_MAP: Record<AccountType, { type: string; subType: string }> = {
	cash: { type: 'asset', subType: 'kas' },
	bank: { type: 'asset', subType: 'bank' },
	ewallet: { type: 'asset', subType: 'ewallet' }
};

// Map schema subType to API type
export const SUBTYPE_TO_API_MAP: Record<string, string> = {
	kas: 'cash',
	bank: 'bank',
	ewallet: 'ewallet'
};

// Validate account type
export function isValidAccountType(type: string): type is AccountType {
	return VALID_ACCOUNT_TYPES.includes(type as AccountType);
}

// Map API type to schema values
export function mapAccountType(type: AccountType): { type: string; subType: string } {
	return ACCOUNT_TYPE_MAP[type];
}

// Map schema subType to API type
export function mapSchemaToApiType(subType: string | null): string {
	return SUBTYPE_TO_API_MAP[subType || ''] || 'cash';
}

// Filter active asset accounts
export function filterActiveAccounts<
	T extends { isActive: boolean; type: string; subType: string | null }
>(accounts: T[]): T[] {
	return accounts.filter(
		(account) => account.isActive && account.type === 'asset' && account.subType
	);
}

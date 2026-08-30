import { MAX_TRANSACTION_AMOUNT, type BusinessType } from '$lib/constants';
import type { SQLiteDb } from '$lib/server/db';
import {
	businessProfile,
	category,
	chartOfAccount,
	onboardingState,
	transactionTemplate
} from '$lib/server/db/schema';
import {
	getCategoryTemplate,
	getTransactionTemplate,
	type BusinessType as SeedBusinessType
} from '$lib/server/db/seed/accounts';
import { isIsoCalendarDate, todayInJakarta } from '$lib/shared/dates';

export type OnboardingStatus = 'completed' | 'skipped';
export type FirstAccountType = 'kas' | 'bank' | 'ewallet';

export type CompleteOnboardingInput = {
	businessName: string;
	ownerName: string;
	businessType: BusinessType;
	accountName: string;
	accountType: FirstAccountType;
	openingBalance: number;
	openingDate: string;
};

export type OnboardingFormResult =
	| { success: true; data: CompleteOnboardingInput }
	| { success: false; errors: Record<string, string> };

const VALID_BUSINESS_TYPES = new Set<BusinessType>([
	'warung_makan',
	'toko_kelontong',
	'jasa',
	'manufaktur',
	'toko_online',
	'lainnya'
]);
const VALID_ACCOUNT_TYPES = new Set<FirstAccountType>(['kas', 'bank', 'ewallet']);

function readText(formData: FormData, key: string): string {
	return formData.get(key)?.toString().trim() ?? '';
}

export function parseOnboardingForm(formData: FormData): OnboardingFormResult {
	const businessName = readText(formData, 'businessName');
	const ownerName = readText(formData, 'ownerName');
	const businessType = readText(formData, 'businessType');
	const accountName = readText(formData, 'accountName');
	const accountType = readText(formData, 'accountType');
	const openingBalanceRaw = readText(formData, 'openingBalance');
	const openingBalance = Number(openingBalanceRaw);
	const openingDate = readText(formData, 'openingDate');
	const errors: Record<string, string> = {};

	if (!businessName) errors.businessName = 'Nama bisnis wajib diisi';
	else if (businessName.length > 120) errors.businessName = 'Nama bisnis maksimal 120 karakter';

	if (!ownerName) errors.ownerName = 'Nama pemilik wajib diisi';
	else if (ownerName.length > 120) errors.ownerName = 'Nama pemilik maksimal 120 karakter';

	if (!VALID_BUSINESS_TYPES.has(businessType as BusinessType)) {
		errors.businessType = 'Pilih jenis bisnis yang valid';
	}

	if (!accountName) errors.accountName = 'Nama akun wajib diisi';
	else if (accountName.length > 120) errors.accountName = 'Nama akun maksimal 120 karakter';

	if (!VALID_ACCOUNT_TYPES.has(accountType as FirstAccountType)) {
		errors.accountType = 'Pilih jenis akun yang valid';
	}

	if (
		openingBalanceRaw === '' ||
		!Number.isSafeInteger(openingBalance) ||
		openingBalance < 0 ||
		openingBalance > MAX_TRANSACTION_AMOUNT
	) {
		errors.openingBalance = `Saldo harus berupa Rupiah bulat antara 0 dan ${MAX_TRANSACTION_AMOUNT}`;
	}
	if (!isIsoCalendarDate(openingDate) || openingDate > todayInJakarta()) {
		errors.openingDate = 'Tanggal saldo awal tidak valid';
	}

	if (Object.keys(errors).length > 0) return { success: false, errors };

	return {
		success: true,
		data: {
			businessName,
			ownerName,
			businessType: businessType as BusinessType,
			accountName,
			accountType: accountType as FirstAccountType,
			openingBalance,
			openingDate
		}
	};
}

function getSeedBusinessType(businessType: BusinessType): SeedBusinessType {
	if (businessType === 'toko_online') return 'toko_kelontong';
	if (businessType === 'lainnya') return 'jasa';
	return businessType;
}

function getFirstAccountCode(accountType: FirstAccountType): string {
	switch (accountType) {
		case 'bank':
			return '1102';
		case 'ewallet':
			return '1103';
		default:
			return '1101';
	}
}

export async function getOnboardingStatus(
	db: SQLiteDb,
	userId: string
): Promise<OnboardingStatus | null> {
	const state = await db.query.onboardingState.findFirst({
		where: (record, { eq }) => eq(record.userId, userId),
		columns: { status: true }
	});

	if (state?.status === 'completed' || state?.status === 'skipped') return state.status;

	// Profiles created before onboarding state existed count as completed.
	const existingProfile = await db.query.businessProfile.findFirst({
		where: (profile, { eq }) => eq(profile.userId, userId),
		columns: { id: true }
	});

	return existingProfile ? 'completed' : null;
}

export async function completeOnboarding(
	db: SQLiteDb,
	userId: string,
	input: CompleteOnboardingInput
): Promise<{ status: OnboardingStatus; created: boolean }> {
	const existingStatus = await getOnboardingStatus(db, userId);
	if (existingStatus) return { status: existingStatus, created: false };

	const now = new Date();
	const seedBusinessType = getSeedBusinessType(input.businessType);
	const categoryIdByName = new Map<string, string>();
	const categoryValues = getCategoryTemplate(seedBusinessType).map((item) => {
		const id = crypto.randomUUID();
		categoryIdByName.set(item.name, id);
		return {
			id,
			userId,
			code: item.code,
			name: item.name,
			type: item.type,
			isSystem: item.isSystem,
			isActive: true,
			icon: item.icon ?? null,
			color: item.color ?? null
		};
	});
	const templateValues = getTransactionTemplate(seedBusinessType).map((item) => ({
		id: crypto.randomUUID(),
		userId,
		name: item.name,
		type: item.type,
		categoryId: item.categoryName ? (categoryIdByName.get(item.categoryName) ?? null) : null,
		description: item.description ?? null,
		isSystem: true,
		isActive: true
	}));

	try {
		await db.batch([
			db.insert(onboardingState).values({
				userId,
				status: 'completed',
				completedAt: now,
				skippedAt: null
			}),
			db.insert(businessProfile).values({
				id: crypto.randomUUID(),
				userId,
				name: input.businessName,
				ownerName: input.ownerName,
				businessType: input.businessType
			}),
			db.insert(chartOfAccount).values({
				id: crypto.randomUUID(),
				userId,
				code: getFirstAccountCode(input.accountType),
				name: input.accountName,
				type: 'asset',
				subType: input.accountType,
				isSystem: true,
				isActive: true,
				parentId: null,
				balance: input.openingBalance,
				openingBalance: input.openingBalance,
				openingDate: input.openingDate
			}),
			db.insert(category).values(categoryValues),
			db.insert(transactionTemplate).values(templateValues)
		]);
	} catch (error) {
		// A concurrent retry loses on onboarding_state.user_id. If another request
		// completed setup, return its canonical outcome instead of duplicating data.
		const concurrentStatus = await getOnboardingStatus(db, userId);
		if (concurrentStatus) return { status: concurrentStatus, created: false };
		throw error;
	}

	return { status: 'completed', created: true };
}

export async function skipOnboarding(
	db: SQLiteDb,
	userId: string
): Promise<{ status: OnboardingStatus; created: boolean }> {
	const existingStatus = await getOnboardingStatus(db, userId);
	if (existingStatus) return { status: existingStatus, created: false };

	try {
		await db.insert(onboardingState).values({
			userId,
			status: 'skipped',
			completedAt: null,
			skippedAt: new Date()
		});
	} catch (error) {
		const concurrentStatus = await getOnboardingStatus(db, userId);
		if (concurrentStatus) return { status: concurrentStatus, created: false };
		throw error;
	}

	return { status: 'skipped', created: true };
}

// Field rules for categories and transaction templates.
// Shared by the API routes, the form actions and the components that render them.

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const CATEGORY_NAME_MAX_LENGTH = 200;
export const TEMPLATE_NAME_MAX_LENGTH = 200;
export const TEMPLATE_DESCRIPTION_MAX_LENGTH = 500;

/** Rendered when a category has no colour, or a stored one that fails validation. */
export const DEFAULT_CATEGORY_COLOR = '#6b7280';
const CATEGORY_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** SAK EMKM code: 4xxx for income, 5xxx-8xxx for expenses. */
const CATEGORY_CODE_PATTERN = { income: /^4\d{3}$/, expense: /^[5-8]\d{3}$/ } as const;

/**
 * Lucide icon names a category may carry: exactly the ones the seeded
 * categories use. `category.test.ts` fails if a seed adds one missing here.
 */
export const CATEGORY_ICONS = [
	'Box',
	'Briefcase',
	'Building',
	'Building2',
	'Calendar',
	'Car',
	'Coffee',
	'Droplets',
	'Factory',
	'Flame',
	'Fuel',
	'Gift',
	'Megaphone',
	'MessageSquare',
	'MoreHorizontal',
	'Package',
	'Paperclip',
	'Percent',
	'Phone',
	'Settings',
	'ShoppingBag',
	'ShoppingCart',
	'TrendingDown',
	'Truck',
	'UserCheck',
	'Users',
	'UtensilsCrossed',
	'Wine',
	'Wrench',
	'Zap'
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
const CATEGORY_ICON_SET: ReadonlySet<string> = new Set(CATEGORY_ICONS);

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

const valid = <T>(value: T): FieldResult<T> => ({ ok: true, value });
const invalid = (error: string): FieldResult<never> => ({ ok: false, error });

export function isCategoryType(value: unknown): value is CategoryType {
	return value === 'income' || value === 'expense';
}

export function isCategoryColor(value: unknown): value is string {
	return typeof value === 'string' && CATEGORY_COLOR_PATTERN.test(value);
}

export function isCategoryIcon(value: unknown): value is CategoryIcon {
	return typeof value === 'string' && CATEGORY_ICON_SET.has(value);
}

/**
 * The colour to put in a `style` attribute. Anything but a six-digit hex
 * (a legacy row, a `url()` beacon) falls back, so no stored value reaches CSS.
 */
export function categoryColorOrDefault(
	value: unknown,
	fallback: string = DEFAULT_CATEGORY_COLOR
): string {
	return isCategoryColor(value) ? value : fallback;
}

function requiredName(value: unknown, label: string, maxLength: number): FieldResult<string> {
	const name = typeof value === 'string' ? value.trim() : '';
	if (!name) return invalid(`Nama ${label} wajib diisi`);
	if (name.length > maxLength) return invalid(`Nama ${label} maksimal ${maxLength} karakter`);
	return valid(name);
}

export function validateCategoryName(value: unknown): FieldResult<string> {
	return requiredName(value, 'kategori', CATEGORY_NAME_MAX_LENGTH);
}

export function validateTemplateName(value: unknown): FieldResult<string> {
	return requiredName(value, 'template', TEMPLATE_NAME_MAX_LENGTH);
}

/** Optional: `undefined`, `null` and `''` mean "generate one". */
export function validateCategoryCode(
	value: unknown,
	type: CategoryType
): FieldResult<string | undefined> {
	if (value === undefined || value === null || value === '') return valid(undefined);
	if (typeof value !== 'string' || !CATEGORY_CODE_PATTERN[type].test(value)) {
		return invalid(
			type === 'income'
				? 'Kode kategori pemasukan harus 4 digit angka yang diawali 4, contoh 4101'
				: 'Kode kategori pengeluaran harus 4 digit angka yang diawali 5-8, contoh 5101'
		);
	}
	return valid(value);
}

/** Optional: `undefined`, `null` and `''` mean "no icon". */
export function validateCategoryIcon(value: unknown): FieldResult<CategoryIcon | undefined> {
	if (value === undefined || value === null || value === '') return valid(undefined);
	return isCategoryIcon(value) ? valid(value) : invalid('Ikon kategori tidak dikenali');
}

/** Optional: `undefined`, `null` and `''` mean "no colour". */
export function validateCategoryColor(value: unknown): FieldResult<string | undefined> {
	if (value === undefined || value === null || value === '') return valid(undefined);
	return isCategoryColor(value)
		? valid(value.toLowerCase())
		: invalid('Warna kategori harus berupa kode hex 6 digit, contoh #22c55e');
}

/**
 * Optional: `undefined` leaves the description untouched; `null` and blank
 * text clear it.
 */
export function validateTemplateDescription(
	value: unknown
): FieldResult<string | null | undefined> {
	if (value === undefined) return valid(undefined);
	if (value === null) return valid(null);
	if (typeof value !== 'string') return invalid('Keterangan template tidak valid');
	const description = value.trim();
	if (description.length > TEMPLATE_DESCRIPTION_MAX_LENGTH) {
		return invalid(`Keterangan maksimal ${TEMPLATE_DESCRIPTION_MAX_LENGTH} karakter`);
	}
	return valid(description || null);
}

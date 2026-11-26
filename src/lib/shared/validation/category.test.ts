import { describe, expect, it } from 'vitest';
import { categoryTemplates } from '$lib/server/db/seed/accounts';
import {
	CATEGORY_ICONS,
	CATEGORY_NAME_MAX_LENGTH,
	DEFAULT_CATEGORY_COLOR,
	TEMPLATE_DESCRIPTION_MAX_LENGTH,
	categoryColorOrDefault,
	isCategoryColor,
	isCategoryIcon,
	isCategoryType,
	validateCategoryCode,
	validateCategoryColor,
	validateCategoryIcon,
	validateCategoryName,
	validateTemplateDescription,
	validateTemplateName
} from './category';

describe('category colour', () => {
	it.each(['#22c55e', '#ABCDEF', '#000000'])('accepts %s', (color) => {
		expect(isCategoryColor(color)).toBe(true);
		expect(categoryColorOrDefault(color)).toBe(color);
	});

	it.each([
		'red',
		'#fff',
		'#22c55e80',
		'22c55e',
		'#22c55g',
		'#22c55e; background-image: url(https://tracker.test/beacon)',
		'url(https://tracker.test/beacon)',
		'#22c55e\n',
		'',
		null,
		undefined,
		42
	])('rejects %j and renders the default instead', (color) => {
		expect(isCategoryColor(color)).toBe(false);
		expect(categoryColorOrDefault(color)).toBe(DEFAULT_CATEGORY_COLOR);
	});

	it('uses a caller fallback for a bad value', () => {
		expect(categoryColorOrDefault('expression(alert(1))', '#e5e7eb')).toBe('#e5e7eb');
	});

	it('treats a missing colour as none and lowercases a valid one', () => {
		expect(validateCategoryColor(undefined)).toEqual({ ok: true, value: undefined });
		expect(validateCategoryColor('')).toEqual({ ok: true, value: undefined });
		expect(validateCategoryColor('#ABCDEF')).toEqual({ ok: true, value: '#abcdef' });
		expect(validateCategoryColor('url(x)')).toMatchObject({ ok: false });
	});
});

describe('category icon', () => {
	it('allows every icon the seeded categories use', () => {
		const seeded = Object.values(categoryTemplates)
			.flat()
			.map((item) => item.icon)
			.filter((icon): icon is string => Boolean(icon));
		expect(seeded.length).toBeGreaterThan(0);
		for (const icon of seeded) expect(isCategoryIcon(icon)).toBe(true);
	});

	it('lists each icon once', () => {
		expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
	});

	it.each(['Skull', 'zap', '<svg onload=alert(1)>', 42])('rejects %j', (icon) => {
		expect(validateCategoryIcon(icon)).toEqual({
			ok: false,
			error: 'Ikon kategori tidak dikenali'
		});
	});

	it('treats a missing icon as none', () => {
		expect(validateCategoryIcon(null)).toEqual({ ok: true, value: undefined });
		expect(validateCategoryIcon('Zap')).toEqual({ ok: true, value: 'Zap' });
	});
});

describe('category type', () => {
	it('accepts only income and expense', () => {
		expect(isCategoryType('income')).toBe(true);
		expect(isCategoryType('expense')).toBe(true);
		for (const value of ['transfer', 'Income', '', null, undefined, 1]) {
			expect(isCategoryType(value)).toBe(false);
		}
	});
});

describe('category code', () => {
	it('is optional', () => {
		expect(validateCategoryCode(undefined, 'income')).toEqual({ ok: true, value: undefined });
		expect(validateCategoryCode('', 'expense')).toEqual({ ok: true, value: undefined });
	});

	it('follows the SAK EMKM range of the type', () => {
		expect(validateCategoryCode('4101', 'income')).toEqual({ ok: true, value: '4101' });
		expect(validateCategoryCode('5101', 'expense')).toEqual({ ok: true, value: '5101' });
		expect(validateCategoryCode('8999', 'expense')).toEqual({ ok: true, value: '8999' });
		expect(validateCategoryCode('5101', 'income')).toMatchObject({ ok: false });
		expect(validateCategoryCode('4101', 'expense')).toMatchObject({ ok: false });
	});

	it.each(['41', '41010', '4a01', ' 4101', '4'.repeat(500), 4101])('rejects %j', (code) => {
		expect(validateCategoryCode(code, 'income')).toMatchObject({ ok: false });
	});
});

describe('names', () => {
	it('trims and requires a category name', () => {
		expect(validateCategoryName('  Bahan Baku ')).toEqual({ ok: true, value: 'Bahan Baku' });
		expect(validateCategoryName('   ')).toEqual({ ok: false, error: 'Nama kategori wajib diisi' });
		expect(validateCategoryName(undefined)).toMatchObject({ ok: false });
		expect(validateCategoryName(['Bahan'])).toMatchObject({ ok: false });
	});

	it('caps the category name length', () => {
		expect(validateCategoryName('a'.repeat(CATEGORY_NAME_MAX_LENGTH))).toMatchObject({
			ok: true
		});
		expect(validateCategoryName('a'.repeat(CATEGORY_NAME_MAX_LENGTH + 1))).toEqual({
			ok: false,
			error: `Nama kategori maksimal ${CATEGORY_NAME_MAX_LENGTH} karakter`
		});
	});

	it('applies the same rules to template names', () => {
		expect(validateTemplateName(' Penjualan ')).toEqual({ ok: true, value: 'Penjualan' });
		expect(validateTemplateName('')).toEqual({ ok: false, error: 'Nama template wajib diisi' });
		expect(validateTemplateName('a'.repeat(1_000))).toMatchObject({ ok: false });
	});
});

describe('template description', () => {
	it('distinguishes untouched from cleared', () => {
		expect(validateTemplateDescription(undefined)).toEqual({ ok: true, value: undefined });
		expect(validateTemplateDescription(null)).toEqual({ ok: true, value: null });
		expect(validateTemplateDescription('   ')).toEqual({ ok: true, value: null });
		expect(validateTemplateDescription(' Bayar listrik ')).toEqual({
			ok: true,
			value: 'Bayar listrik'
		});
	});

	it('caps the length and rejects non-text', () => {
		expect(
			validateTemplateDescription('a'.repeat(TEMPLATE_DESCRIPTION_MAX_LENGTH + 1))
		).toMatchObject({ ok: false });
		expect(validateTemplateDescription({ text: 'x' })).toMatchObject({ ok: false });
	});
});

import { describe, expect, it } from 'vitest';
import {
	validateCategoryCode,
	validateCategoryColor,
	validateCategoryIcon,
	validateCategoryName
} from '$lib/shared/validation/category';
import { LOAN_INTEREST_CATEGORIES, loanInterestDescription } from './interest';

describe('loan interest categories', () => {
	it('follow the rules every category follows', () => {
		for (const type of ['income', 'expense'] as const) {
			const definition = LOAN_INTEREST_CATEGORIES[type];
			expect(validateCategoryCode(definition.code, type)).toEqual({
				ok: true,
				value: definition.code
			});
			expect(validateCategoryName(definition.name)).toEqual({ ok: true, value: definition.name });
			expect(validateCategoryIcon(definition.icon).ok).toBe(true);
			expect(validateCategoryColor(definition.color).ok).toBe(true);
		}
	});

	it('names the interest after the side of the loan', () => {
		expect(loanInterestDescription('hutang', 'Koperasi')).toBe('Bunga pinjaman ke Koperasi');
		expect(loanInterestDescription('piutang', 'Citra')).toBe('Bunga pinjaman dari Citra');
	});
});

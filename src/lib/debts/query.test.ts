import { describe, expect, it } from 'vitest';
import { getDebtDetailHref, getDebtHref, getSafeDebtListHref, parseDebtQuery } from './query';

describe('debt list query contract', () => {
	it('normalizes invalid and incompatible URL state', () => {
		expect(
			parseDebtQuery(
				new URLSearchParams('type=invalid&status=paid&due=overdue&sort=unknown&q=%20Budi%20')
			)
		).toEqual({
			type: 'piutang',
			status: 'paid',
			due: 'all',
			sort: 'urgency',
			q: 'Budi'
		});
	});

	it('builds shareable list and context-preserving detail links', () => {
		const query = parseDebtQuery(
			new URLSearchParams('type=hutang&status=all&due=due-soon&sort=balance-desc&q=Toko')
		);
		const listHref = getDebtHref(query);

		expect(listHref).toBe(
			'/hutang-piutang?type=hutang&status=all&due=due-soon&sort=balance-desc&q=Toko'
		);
		expect(getDebtDetailHref('debt-1', query)).toContain(
			`return_to=${encodeURIComponent(listHref)}`
		);
	});

	it('restores only a canonical debt list destination', () => {
		const target = '/hutang-piutang?type=hutang&status=all&due=overdue&sort=due-asc&q=andi';
		expect(getSafeDebtListHref(target, 'piutang')).toBe(target);
		expect(getSafeDebtListHref('https://evil.example/hutang-piutang', 'hutang')).toBe(
			'/hutang-piutang?type=hutang'
		);
		expect(getSafeDebtListHref('/pengaturan', 'piutang')).toBe('/hutang-piutang?type=piutang');
	});
});

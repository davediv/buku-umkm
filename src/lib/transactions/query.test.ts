import { describe, expect, it } from 'vitest';
import {
	getSafeTransactionListHref,
	getTransactionDetailHref,
	getTransactionHref,
	getTransactionOutcomeHref,
	getTransactionPagination,
	parseTransactionQuery,
	toTransactionSearchParams
} from './query';

describe('transaction query contract', () => {
	it('applies a real current-month filter by default', () => {
		const query = parseTransactionQuery(new URLSearchParams(), '2026-08-30');

		expect(query).toMatchObject({
			range: 'month',
			startDate: '2026-08-01',
			endDate: '2026-08-30',
			sortBy: 'date',
			sortOrder: 'desc',
			page: 1,
			pageSize: 10
		});
	});

	it('normalizes all supported filters and pagination values', () => {
		const query = parseTransactionQuery(
			new URLSearchParams(
				'q=  kopi  &type=expense&range=custom&start=2026-07-01&end=2026-07-31&sort=amount&order=asc&page=3&page_size=25'
			),
			'2026-08-30'
		);

		expect(query).toEqual({
			q: 'kopi',
			type: 'expense',
			range: 'custom',
			startDate: '2026-07-01',
			endDate: '2026-07-31',
			sortBy: 'amount',
			sortOrder: 'asc',
			page: 3,
			pageSize: 25
		});
	});

	it('rejects invalid custom dates and unsupported values safely', () => {
		const query = parseTransactionQuery(
			new URLSearchParams(
				'type=credit&range=custom&start=2026-09-01&end=2026-08-01&sort=name&order=sideways&page=-2&page_size=999'
			),
			'2026-08-30'
		);

		expect(query).toMatchObject({
			type: 'all',
			range: 'month',
			startDate: '2026-08-01',
			endDate: '2026-08-30',
			sortBy: 'date',
			sortOrder: 'desc',
			page: 1,
			pageSize: 10
		});
	});

	it('uses the current Jakarta calendar week', () => {
		const query = parseTransactionQuery(new URLSearchParams('range=week'), '2026-08-30');

		expect(query.startDate).toBe('2026-08-24');
		expect(query.endDate).toBe('2026-08-30');
	});

	it('clamps out-of-range pages using the server total', () => {
		expect(getTransactionPagination(51, 99, 25)).toEqual({
			page: 3,
			pageSize: 25,
			total: 51,
			totalPages: 3,
			offset: 50
		});
		expect(getTransactionPagination(0, 4, 10).page).toBe(1);
	});

	it('serializes applied state for links and export without pagination', () => {
		const query = parseTransactionQuery(
			new URLSearchParams('q=kopi&type=income&range=all&page=2&page_size=25'),
			'2026-08-30'
		);

		expect(getTransactionHref(query, { sortBy: 'amount', page: 1 })).toContain(
			'q=kopi&type=income&range=all&sort=amount&order=desc&page=1&page_size=25'
		);
		expect(toTransactionSearchParams(query, {}, false).has('page')).toBe(false);
	});

	it('preserves canonical list state through detail and mutation navigation', () => {
		const query = parseTransactionQuery(
			new URLSearchParams('q=kopi&type=expense&range=all&page=3&page_size=25'),
			'2026-08-30'
		);
		const listHref = getTransactionHref(query);
		const detailHref = getTransactionDetailHref('txn_1', query);

		expect(detailHref).toBe(`/transaksi/txn_1?return_to=${encodeURIComponent(listHref)}`);
		expect(getSafeTransactionListHref(listHref, '2026-08-30')).toBe(listHref);
		expect(getTransactionOutcomeHref(listHref, 'updated', '2026-08-30')).toBe(
			`${listHref}&success=updated`
		);
	});

	it('rejects unrelated or external transaction return targets', () => {
		expect(getSafeTransactionListHref('https://evil.example/transaksi')).toBeNull();
		expect(getSafeTransactionListHref('/pengaturan')).toBeNull();
	});
});

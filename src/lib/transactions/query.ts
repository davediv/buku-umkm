import { isIsoCalendarDate, todayInJakarta } from '$lib/shared/dates';
import { getSafeAppReturnTo } from '$lib/navigation/return-to';

export const TRANSACTION_TYPES = ['all', 'income', 'expense', 'transfer'] as const;
export const TRANSACTION_DATE_RANGES = ['all', 'today', 'week', 'month', 'custom'] as const;
export const TRANSACTION_SORT_FIELDS = ['date', 'amount'] as const;
export const TRANSACTION_SORT_ORDERS = ['asc', 'desc'] as const;
export const TRANSACTION_PAGE_SIZES = [10, 25, 50] as const;

export type TransactionTypeFilter = (typeof TRANSACTION_TYPES)[number];
export type TransactionDateRange = (typeof TRANSACTION_DATE_RANGES)[number];
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];
export type TransactionSortOrder = (typeof TRANSACTION_SORT_ORDERS)[number];

export interface TransactionQuery {
	q: string;
	type: TransactionTypeFilter;
	range: TransactionDateRange;
	startDate?: string;
	endDate?: string;
	sortBy: TransactionSortField;
	sortOrder: TransactionSortOrder;
	page: number;
	pageSize: (typeof TRANSACTION_PAGE_SIZES)[number];
}

export interface TransactionPagination {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	offset: number;
}

function isOneOf<T extends readonly string[]>(values: T, value: string | null): value is T[number] {
	return value !== null && values.includes(value as T[number]);
}

function positiveInteger(value: string | null, fallback: number): number {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shiftDate(value: string, days: number): string {
	const date = new Date(`${value}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function getDateBounds(
	range: TransactionDateRange,
	params: URLSearchParams,
	today: string
): Pick<TransactionQuery, 'range' | 'startDate' | 'endDate'> {
	switch (range) {
		case 'all':
			return { range };
		case 'today':
			return { range, startDate: today, endDate: today };
		case 'week': {
			const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
			const daysSinceMonday = (day + 6) % 7;
			return { range, startDate: shiftDate(today, -daysSinceMonday), endDate: today };
		}
		case 'month':
			return { range, startDate: `${today.slice(0, 7)}-01`, endDate: today };
		case 'custom': {
			const startDate = params.get('start');
			const endDate = params.get('end');
			if (
				startDate &&
				endDate &&
				isIsoCalendarDate(startDate) &&
				isIsoCalendarDate(endDate) &&
				startDate <= endDate &&
				endDate <= today
			) {
				return { range, startDate, endDate };
			}
			return { range: 'month', startDate: `${today.slice(0, 7)}-01`, endDate: today };
		}
	}
}

export function parseTransactionQuery(
	params: URLSearchParams,
	today = todayInJakarta()
): TransactionQuery {
	const requestedRange = params.get('range');
	const range: TransactionDateRange = isOneOf(TRANSACTION_DATE_RANGES, requestedRange)
		? requestedRange
		: 'month';
	const requestedPageSize = positiveInteger(params.get('page_size'), 10);
	const requestedType = params.get('type');
	const requestedSort = params.get('sort');
	const requestedOrder = params.get('order');
	const pageSize = TRANSACTION_PAGE_SIZES.includes(
		requestedPageSize as (typeof TRANSACTION_PAGE_SIZES)[number]
	)
		? (requestedPageSize as (typeof TRANSACTION_PAGE_SIZES)[number])
		: 10;

	return {
		q: (params.get('q') ?? '').trim().slice(0, 100),
		type: isOneOf(TRANSACTION_TYPES, requestedType) ? requestedType : 'all',
		...getDateBounds(range, params, today),
		sortBy: isOneOf(TRANSACTION_SORT_FIELDS, requestedSort) ? requestedSort : 'date',
		sortOrder: isOneOf(TRANSACTION_SORT_ORDERS, requestedOrder) ? requestedOrder : 'desc',
		page: Math.min(positiveInteger(params.get('page'), 1), 1_000_000),
		pageSize
	};
}

export function getTransactionPagination(
	total: number,
	requestedPage: number,
	pageSize: number
): TransactionPagination {
	const safeTotal = Math.max(0, Math.trunc(total));
	const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
	const page = Math.min(Math.max(1, requestedPage), totalPages);

	return {
		page,
		pageSize,
		total: safeTotal,
		totalPages,
		offset: (page - 1) * pageSize
	};
}

export function toTransactionSearchParams(
	query: TransactionQuery,
	overrides: Partial<
		Pick<
			TransactionQuery,
			| 'q'
			| 'type'
			| 'range'
			| 'startDate'
			| 'endDate'
			| 'sortBy'
			| 'sortOrder'
			| 'page'
			| 'pageSize'
		>
	> = {},
	includePagination = true
): URLSearchParams {
	const next = { ...query, ...overrides };
	const params = new URLSearchParams();

	if (next.q) params.set('q', next.q);
	if (next.type !== 'all') params.set('type', next.type);
	params.set('range', next.range);
	if (next.range === 'custom' && next.startDate && next.endDate) {
		params.set('start', next.startDate);
		params.set('end', next.endDate);
	}
	params.set('sort', next.sortBy);
	params.set('order', next.sortOrder);
	if (includePagination) {
		params.set('page', String(next.page));
		params.set('page_size', String(next.pageSize));
	}

	return params;
}

export function getTransactionHref(
	query: TransactionQuery,
	overrides: Parameters<typeof toTransactionSearchParams>[1] = {}
): string {
	return `/transaksi?${toTransactionSearchParams(query, overrides).toString()}`;
}

export function getTransactionDetailHref(id: string, query: TransactionQuery): string {
	const returnTo = getTransactionHref(query);
	return `/transaksi/${encodeURIComponent(id)}?${new URLSearchParams({ return_to: returnTo }).toString()}`;
}

export function getSafeTransactionListHref(
	value: string | null | undefined,
	today = todayInJakarta()
): string | null {
	const safe = getSafeAppReturnTo(value);
	if (!safe) return null;

	const parsed = new URL(safe, 'https://buku-umkm.invalid');
	if (parsed.pathname !== '/transaksi') return null;
	return getTransactionHref(parseTransactionQuery(parsed.searchParams, today));
}

export function getTransactionOutcomeHref(
	returnTo: string | null | undefined,
	outcome: 'created' | 'created-without-receipts' | 'updated' | 'deleted',
	today = todayInJakarta()
): string {
	const safe = getSafeTransactionListHref(returnTo, today) ?? '/transaksi';
	const parsed = new URL(safe, 'https://buku-umkm.invalid');
	parsed.searchParams.set('success', outcome);
	return `${parsed.pathname}${parsed.search}`;
}

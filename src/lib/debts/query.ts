export type DebtTypeFilter = 'piutang' | 'hutang';
export type DebtStatusFilter = 'outstanding' | 'paid' | 'all';
export type DebtDueFilter = 'all' | 'overdue' | 'due-soon' | 'no-due-date';
export type DebtSort = 'urgency' | 'due-asc' | 'balance-desc' | 'balance-asc' | 'contact-asc';

export type DebtQuery = {
	type: DebtTypeFilter;
	status: DebtStatusFilter;
	due: DebtDueFilter;
	sort: DebtSort;
	q: string;
};

export const DEFAULT_DEBT_QUERY: DebtQuery = {
	type: 'piutang',
	status: 'outstanding',
	due: 'all',
	sort: 'urgency',
	q: ''
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
	return value && allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseDebtQuery(params: URLSearchParams): DebtQuery {
	const type = oneOf(params.get('type'), ['piutang', 'hutang'] as const, DEFAULT_DEBT_QUERY.type);
	const status = oneOf(
		params.get('status'),
		['outstanding', 'paid', 'all'] as const,
		DEFAULT_DEBT_QUERY.status
	);
	const requestedDue = oneOf(
		params.get('due'),
		['all', 'overdue', 'due-soon', 'no-due-date'] as const,
		DEFAULT_DEBT_QUERY.due
	);

	return {
		type,
		status,
		due: status === 'paid' ? 'all' : requestedDue,
		sort: oneOf(
			params.get('sort'),
			['urgency', 'due-asc', 'balance-desc', 'balance-asc', 'contact-asc'] as const,
			DEFAULT_DEBT_QUERY.sort
		),
		q: (params.get('q') ?? '').trim().slice(0, 100)
	};
}

export function toDebtSearchParams(
	query: DebtQuery,
	overrides: Partial<DebtQuery> = {}
): URLSearchParams {
	const next = { ...query, ...overrides };
	if (next.status === 'paid') next.due = 'all';
	const params = new URLSearchParams({ type: next.type });
	if (next.status !== DEFAULT_DEBT_QUERY.status) params.set('status', next.status);
	if (next.due !== DEFAULT_DEBT_QUERY.due) params.set('due', next.due);
	if (next.sort !== DEFAULT_DEBT_QUERY.sort) params.set('sort', next.sort);
	if (next.q.trim()) params.set('q', next.q.trim().slice(0, 100));
	return params;
}

export function getDebtHref(query: DebtQuery, overrides: Partial<DebtQuery> = {}): string {
	return `/hutang-piutang?${toDebtSearchParams(query, overrides).toString()}`;
}

export function getDebtDetailHref(id: string, query: DebtQuery): string {
	const params = new URLSearchParams({ return_to: getDebtHref(query) });
	return `/hutang-piutang/${encodeURIComponent(id)}?${params.toString()}`;
}

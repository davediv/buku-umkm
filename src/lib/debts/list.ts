import type { DebtDueFilter, DebtQuery } from './query';

export type DebtListRecord = {
	id: string;
	type: string;
	contactName: string;
	contactPhone: string | null;
	contactAddress: string | null;
	originalAmount: number;
	paidAmount: number;
	remainingAmount: number;
	date: string;
	dueDate: string | null;
	description: string | null;
	status: string;
};

export type DebtDueKind = 'paid' | 'overdue' | 'due-soon' | 'scheduled' | 'no-due-date';

export type DebtDueState = {
	kind: DebtDueKind;
	label: string;
	daysFromToday: number | null;
	badgeClass: string;
};

export type DebtTypeSummary = {
	remaining: number;
	count: number;
	overdueCount: number;
	dueSoonCount: number;
};

function isoDayNumber(value: string): number {
	return Date.parse(`${value}T00:00:00.000Z`) / 86_400_000;
}

export function getDebtDueState(
	debt: Pick<DebtListRecord, 'remainingAmount' | 'status' | 'dueDate'>,
	today: string
): DebtDueState {
	if (debt.remainingAmount <= 0 || debt.status === 'paid') {
		return {
			kind: 'paid',
			label: 'Lunas',
			daysFromToday: null,
			badgeClass: 'bg-green-100 text-green-800'
		};
	}
	if (!debt.dueDate) {
		return {
			kind: 'no-due-date',
			label: 'Tanpa jatuh tempo',
			daysFromToday: null,
			badgeClass: 'bg-gray-100 text-gray-700'
		};
	}

	const daysFromToday = isoDayNumber(debt.dueDate) - isoDayNumber(today);
	if (daysFromToday < 0) {
		const daysLate = Math.abs(daysFromToday);
		return {
			kind: 'overdue',
			label: `Terlambat ${daysLate} hari`,
			daysFromToday,
			badgeClass: 'bg-red-100 text-red-800'
		};
	}
	if (daysFromToday <= 7) {
		return {
			kind: 'due-soon',
			label:
				daysFromToday === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${daysFromToday} hari lagi`,
			daysFromToday,
			badgeClass: 'bg-amber-100 text-amber-900'
		};
	}
	return {
		kind: 'scheduled',
		label: 'Terjadwal',
		daysFromToday,
		badgeClass: 'bg-blue-100 text-blue-800'
	};
}

function matchesDueFilter(kind: DebtDueKind, filter: DebtDueFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'overdue') return kind === 'overdue';
	if (filter === 'due-soon') return kind === 'due-soon';
	return kind === 'no-due-date';
}

function urgencyRank(kind: DebtDueKind): number {
	return ['overdue', 'due-soon', 'scheduled', 'no-due-date', 'paid'].indexOf(kind);
}

function compareNullableDates(left: string | null, right: string | null): number {
	if (left && right) return left.localeCompare(right);
	if (left) return -1;
	if (right) return 1;
	return 0;
}

export function getDebtList(records: DebtListRecord[], query: DebtQuery, today: string) {
	const summary = {
		piutang: { remaining: 0, count: 0, overdueCount: 0, dueSoonCount: 0 },
		hutang: { remaining: 0, count: 0, overdueCount: 0, dueSoonCount: 0 }
	} satisfies Record<'piutang' | 'hutang', DebtTypeSummary>;

	for (const debt of records) {
		if (debt.type !== 'piutang' && debt.type !== 'hutang') continue;
		const typeSummary = summary[debt.type];
		const dueState = getDebtDueState(debt, today);
		typeSummary.remaining += Math.max(0, debt.remainingAmount);
		typeSummary.count += 1;
		if (dueState.kind === 'overdue') typeSummary.overdueCount += 1;
		if (dueState.kind === 'due-soon') typeSummary.dueSoonCount += 1;
	}

	const normalizedSearch = query.q.toLocaleLowerCase('id-ID');
	const items = records
		.filter((debt) => debt.type === query.type)
		.filter((debt) => {
			const paid = debt.remainingAmount <= 0 || debt.status === 'paid';
			return query.status === 'all' || (query.status === 'paid' ? paid : !paid);
		})
		.filter((debt) => matchesDueFilter(getDebtDueState(debt, today).kind, query.due))
		.filter((debt) => {
			if (!normalizedSearch) return true;
			return [debt.contactName, debt.contactPhone, debt.description]
				.filter(Boolean)
				.some((value) => value!.toLocaleLowerCase('id-ID').includes(normalizedSearch));
		})
		.sort((left, right) => {
			switch (query.sort) {
				case 'due-asc':
					return (
						compareNullableDates(left.dueDate, right.dueDate) || left.id.localeCompare(right.id)
					);
				case 'balance-desc':
					return right.remainingAmount - left.remainingAmount || left.id.localeCompare(right.id);
				case 'balance-asc':
					return left.remainingAmount - right.remainingAmount || left.id.localeCompare(right.id);
				case 'contact-asc':
					return (
						left.contactName.localeCompare(right.contactName, 'id-ID') ||
						left.id.localeCompare(right.id)
					);
				case 'urgency': {
					const leftState = getDebtDueState(left, today);
					const rightState = getDebtDueState(right, today);
					return (
						urgencyRank(leftState.kind) - urgencyRank(rightState.kind) ||
						compareNullableDates(left.dueDate, right.dueDate) ||
						right.remainingAmount - left.remainingAmount ||
						left.id.localeCompare(right.id)
					);
				}
			}
		});

	return { items, summary };
}

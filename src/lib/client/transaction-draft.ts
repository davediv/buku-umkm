export const TRANSACTION_DRAFT_KEY = 'buku-umkm:transaction-draft:v1';

export type TransactionDraft = {
	version: 2;
	commandId: string;
	type: 'income' | 'expense';
	amount: string;
	categoryId: string;
	accountId: string;
	date: string;
	description: string;
	referenceNumber: string;
	notes: string;
	updatedAt: string;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function parseTransactionDraft(value: unknown): TransactionDraft | null {
	if (!value || typeof value !== 'object') return null;
	const draft = value as Record<string, unknown>;
	const valid =
		(draft.version === 1 || draft.version === 2) &&
		typeof draft.commandId === 'string' &&
		(draft.type === 'income' || draft.type === 'expense') &&
		typeof draft.amount === 'string' &&
		typeof draft.categoryId === 'string' &&
		typeof draft.accountId === 'string' &&
		typeof draft.date === 'string' &&
		typeof draft.description === 'string' &&
		typeof draft.updatedAt === 'string';
	if (!valid) return null;

	return {
		version: 2,
		commandId: draft.commandId as string,
		type: draft.type as 'income' | 'expense',
		amount: draft.amount as string,
		categoryId: draft.categoryId as string,
		accountId: draft.accountId as string,
		date: draft.date as string,
		description: draft.description as string,
		referenceNumber: typeof draft.referenceNumber === 'string' ? draft.referenceNumber : '',
		notes: typeof draft.notes === 'string' ? draft.notes : '',
		updatedAt: draft.updatedAt as string
	};
}

export function loadTransactionDraft(
	storage: DraftStorage = localStorage
): TransactionDraft | null {
	try {
		const serialized = storage.getItem(TRANSACTION_DRAFT_KEY);
		if (!serialized) return null;
		const parsed: unknown = JSON.parse(serialized);
		return parseTransactionDraft(parsed);
	} catch {
		return null;
	}
}

export function saveTransactionDraft(
	draft: Omit<TransactionDraft, 'version' | 'updatedAt'>,
	storage: DraftStorage = localStorage
): void {
	try {
		storage.setItem(
			TRANSACTION_DRAFT_KEY,
			JSON.stringify({ ...draft, version: 2, updatedAt: new Date().toISOString() })
		);
	} catch {
		// Draft persistence is best-effort; canonical financial records remain server-owned.
	}
}

export function clearTransactionDraft(storage: DraftStorage = localStorage): void {
	try {
		storage.removeItem(TRANSACTION_DRAFT_KEY);
	} catch {
		// A storage failure must not affect a successfully saved server record.
	}
}

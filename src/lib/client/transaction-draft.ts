export const TRANSACTION_DRAFT_KEY = 'buku-umkm:transaction-draft:v1';

export type TransactionDraft = {
	version: 1;
	type: 'income' | 'expense';
	amount: string;
	categoryId: string;
	accountId: string;
	date: string;
	description: string;
	updatedAt: string;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isTransactionDraft(value: unknown): value is TransactionDraft {
	if (!value || typeof value !== 'object') return false;
	const draft = value as Record<string, unknown>;
	return (
		draft.version === 1 &&
		(draft.type === 'income' || draft.type === 'expense') &&
		typeof draft.amount === 'string' &&
		typeof draft.categoryId === 'string' &&
		typeof draft.accountId === 'string' &&
		typeof draft.date === 'string' &&
		typeof draft.description === 'string' &&
		typeof draft.updatedAt === 'string'
	);
}

export function loadTransactionDraft(
	storage: DraftStorage = localStorage
): TransactionDraft | null {
	try {
		const serialized = storage.getItem(TRANSACTION_DRAFT_KEY);
		if (!serialized) return null;
		const parsed: unknown = JSON.parse(serialized);
		return isTransactionDraft(parsed) ? parsed : null;
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
			JSON.stringify({ ...draft, version: 1, updatedAt: new Date().toISOString() })
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

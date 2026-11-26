import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearTransactionDraft,
	loadTransactionDraft,
	LEGACY_TRANSACTION_DRAFT_KEY,
	saveTransactionDraft,
	transactionDraftKey
} from './transaction-draft';

const USER = 'user-ayu';

const draftInput = {
	commandId: 'command-1',
	type: 'expense' as const,
	amount: '25000',
	categoryId: 'category-1',
	accountId: 'account-1',
	date: '2026-08-30',
	description: 'Beli bahan',
	referenceNumber: 'INV-01',
	notes: 'Tunai'
};

function createStorage() {
	const values = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => values.set(key, value)),
		removeItem: vi.fn((key: string) => values.delete(key))
	};
}

describe('transaction draft storage', () => {
	beforeEach(() => vi.useRealTimers());

	it('round-trips supported draft fields with version metadata', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-30T08:00:00.000Z'));
		const storage = createStorage();

		saveTransactionDraft(USER, draftInput, storage);

		expect(loadTransactionDraft(USER, storage)).toEqual({
			version: 2,
			commandId: 'command-1',
			type: 'expense',
			amount: '25000',
			categoryId: 'category-1',
			accountId: 'account-1',
			date: '2026-08-30',
			description: 'Beli bahan',
			referenceNumber: 'INV-01',
			notes: 'Tunai',
			updatedAt: '2026-08-30T08:00:00.000Z'
		});
	});

	it('migrates version 1 drafts without discarding entered work', () => {
		const storage = createStorage();
		storage.setItem(
			transactionDraftKey(USER),
			JSON.stringify({
				version: 1,
				commandId: 'command-old',
				type: 'income',
				amount: '100000',
				categoryId: '',
				accountId: 'account-1',
				date: '2026-08-29',
				description: 'Penjualan',
				updatedAt: '2026-08-29T08:00:00.000Z'
			})
		);

		expect(loadTransactionDraft(USER, storage)).toMatchObject({
			version: 2,
			commandId: 'command-old',
			referenceNumber: '',
			notes: ''
		});
	});

	it('rejects corrupted data and clears only the transaction draft key', () => {
		const storage = createStorage();
		storage.setItem(transactionDraftKey(USER), '{bad json');

		expect(loadTransactionDraft(USER, storage)).toBeNull();
		clearTransactionDraft(USER, storage);
		expect(storage.removeItem).toHaveBeenLastCalledWith(transactionDraftKey(USER));
	});

	it("keeps each account's draft private to that account on a shared device", () => {
		const storage = createStorage();
		saveTransactionDraft(USER, draftInput, storage);

		expect(loadTransactionDraft('user-budi', storage)).toBeNull();
		clearTransactionDraft('user-budi', storage);
		expect(loadTransactionDraft(USER, storage)).toMatchObject({ amount: '25000' });
	});

	it('discards the pre-account shared draft because its owner is unknown', () => {
		const storage = createStorage();
		storage.setItem(
			LEGACY_TRANSACTION_DRAFT_KEY,
			JSON.stringify({ ...draftInput, version: 2, updatedAt: '2026-08-30T08:00:00.000Z' })
		);

		expect(loadTransactionDraft(USER, storage)).toBeNull();
		expect(storage.getItem(LEGACY_TRANSACTION_DRAFT_KEY)).toBeNull();
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearTransactionDraft,
	loadTransactionDraft,
	saveTransactionDraft,
	TRANSACTION_DRAFT_KEY
} from './transaction-draft';

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

		saveTransactionDraft(
			{
				type: 'expense',
				amount: '25000',
				categoryId: 'category-1',
				accountId: 'account-1',
				date: '2026-08-30',
				description: 'Beli bahan'
			},
			storage
		);

		expect(loadTransactionDraft(storage)).toEqual({
			version: 1,
			type: 'expense',
			amount: '25000',
			categoryId: 'category-1',
			accountId: 'account-1',
			date: '2026-08-30',
			description: 'Beli bahan',
			updatedAt: '2026-08-30T08:00:00.000Z'
		});
	});

	it('rejects corrupted data and clears only the transaction draft key', () => {
		const storage = createStorage();
		storage.setItem(TRANSACTION_DRAFT_KEY, '{bad json');

		expect(loadTransactionDraft(storage)).toBeNull();
		clearTransactionDraft(storage);
		expect(storage.removeItem).toHaveBeenCalledWith(TRANSACTION_DRAFT_KEY);
	});
});

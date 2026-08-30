import { describe, expect, it } from 'vitest';
import {
	getRememberedNavigationOrigin,
	rememberNavigationOrigin,
	shouldUseHistoryBack
} from './navigation-continuity';

describe('context back navigation', () => {
	it('uses browser history only when the previous entry is the exact return target', () => {
		const origin = 'https://buku.test';
		const list = '/transaksi?q=kopi&page=3';

		expect(shouldUseHistoryBack(list, `${origin}${list}`, origin)).toBe(true);
		expect(shouldUseHistoryBack(list, `${origin}/transaksi?q=teh&page=1`, origin)).toBe(false);
		expect(shouldUseHistoryBack(list, 'https://evil.example/transaksi?q=kopi&page=3', origin)).toBe(
			false
		);
		expect(shouldUseHistoryBack(list, '', origin)).toBe(false);
	});

	it('remembers the exact origin of the latest client-side destination', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value)
		};

		rememberNavigationOrigin('/transaksi/txn-1?return_to=list', '/transaksi?q=kopi', storage);

		expect(getRememberedNavigationOrigin('/transaksi/txn-1?return_to=list', storage)).toBe(
			'/transaksi?q=kopi'
		);
		expect(getRememberedNavigationOrigin('/transaksi/txn-2', storage)).toBeNull();
	});
});

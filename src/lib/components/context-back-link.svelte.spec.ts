import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ContextBackLink from './context-back-link.svelte';

describe('ContextBackLink', () => {
	it('keeps an addressable fallback destination', async () => {
		render(ContextBackLink, {
			href: '/transaksi?q=kopi&page=3',
			label: 'Kembali ke daftar transaksi'
		});

		await expect
			.element(page.getByRole('link', { name: 'Kembali ke daftar transaksi' }))
			.toHaveAttribute('href', '/transaksi?q=kopi&page=3');
	});
});

import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PageErrorState from './page-error-state.svelte';

describe('PageErrorState', () => {
	it('announces failures and exposes one retry action', async () => {
		const onretry = vi.fn();
		render(PageErrorState, {
			status: 500,
			message: 'Transaksi tidak dapat dimuat.',
			onretry
		});

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Transaksi tidak dapat dimuat.');
		await page.getByRole('button', { name: 'Coba lagi' }).click();
		expect(onretry).toHaveBeenCalledOnce();
	});

	it('distinguishes offline state from an empty collection', async () => {
		render(PageErrorState, { status: 500, message: 'Data gagal dimuat.' });
		window.dispatchEvent(new Event('offline'));

		await expect.element(page.getByRole('alert')).toHaveTextContent('Anda sedang offline');
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Tidak ada data kosong yang ditampilkan');
		await expect.element(page.getByRole('button', { name: 'Tunggu koneksi' })).toBeDisabled();
	});
});

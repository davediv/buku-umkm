import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConnectionStatus from './connection-status.svelte';

describe('ConnectionStatus', () => {
	it('announces online and offline-stale states', async () => {
		render(ConnectionStatus, { loadedAt: '2026-08-30T08:00:00.000Z' });

		const status = page.getByRole('status');
		await expect.element(status).toHaveTextContent('Online · perubahan tersimpan ke akun Anda');

		window.dispatchEvent(new Event('offline'));
		await expect.element(status).toHaveTextContent(/Offline · data dari pukul .* mungkin usang/);
		await expect.element(status).toHaveTextContent('perubahan belum dapat disimpan');
	});
});

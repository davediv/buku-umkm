import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OperationStatus from './operation-status.svelte';

describe('OperationStatus', () => {
	it('announces errors assertively and success politely', async () => {
		const view = await render(OperationStatus, { kind: 'error', message: 'Data belum disimpan.' });
		await expect.element(page.getByRole('alert')).toMatchTextContent('Tindakan gagal');
		view.unmount();

		await render(OperationStatus, { kind: 'success', message: 'Data berhasil disimpan.' });
		await expect.element(page.getByRole('status')).toMatchTextContent('Berhasil');
	});
});

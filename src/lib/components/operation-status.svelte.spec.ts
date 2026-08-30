import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OperationStatus from './operation-status.svelte';

describe('OperationStatus', () => {
	it('announces errors assertively and success politely', async () => {
		const view = render(OperationStatus, { kind: 'error', message: 'Data belum disimpan.' });
		await expect.element(page.getByRole('alert')).toHaveTextContent('Tindakan gagal');
		view.unmount();

		render(OperationStatus, { kind: 'success', message: 'Data berhasil disimpan.' });
		await expect.element(page.getByRole('status')).toHaveTextContent('Berhasil');
	});
});

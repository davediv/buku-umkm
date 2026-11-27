import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from './index.svelte';
import Toast from './toast.svelte';

describe('Toast', () => {
	it('announces errors assertively', async () => {
		await render(Toast);
		const id = toast.error('Penyimpanan gagal', 'Data belum diubah.');

		await expect.element(page.getByRole('alert')).toMatchTextContent('Data belum diubah.');
		toast.remove(id);
	});

	it('announces successful outcomes politely', async () => {
		await render(Toast);
		const id = toast.success('Data tersimpan');

		await expect.element(page.getByRole('status')).toMatchTextContent('Data tersimpan');
		toast.remove(id);
	});
});

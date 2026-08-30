import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from './index.svelte';
import Toast from './toast.svelte';

describe('Toast', () => {
	it('announces errors assertively', async () => {
		render(Toast);
		const id = toast.error('Penyimpanan gagal', 'Data belum diubah.');

		await expect.element(page.getByRole('alert')).toHaveTextContent('Data belum diubah.');
		toast.remove(id);
	});

	it('announces successful outcomes politely', async () => {
		render(Toast);
		const id = toast.success('Data tersimpan');

		await expect.element(page.getByRole('status')).toHaveTextContent('Data tersimpan');
		toast.remove(id);
	});
});

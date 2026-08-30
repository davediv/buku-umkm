import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AlertDialogTestHost from './alert-dialog-test-host.svelte';

describe('AlertDialog', () => {
	it('focuses the safe action and lets cancel close the parent dialog', async () => {
		render(AlertDialogTestHost);

		await page.getByRole('button', { name: 'Hapus data' }).click();
		const dialog = page.getByRole('alertdialog', { name: 'Hapus data?' });
		const cancel = page.getByRole('button', { name: 'Batal' });
		await expect.element(cancel).toHaveFocus();
		await cancel.click();
		await expect.element(dialog).not.toBeInTheDocument();
	});
});

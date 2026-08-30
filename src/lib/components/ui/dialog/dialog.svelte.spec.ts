import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DialogTestHost from './dialog-test-host.svelte';

describe('Dialog', () => {
	it('manages initial focus, traps focus, closes with Escape, and restores focus', async () => {
		render(DialogTestHost);

		const trigger = page.getByRole('button', { name: 'Buka dialog' });
		await trigger.click();

		const dialog = page.getByRole('dialog', { name: 'Dialog pengujian' });
		const cancel = page.getByRole('button', { name: 'Batalkan' });
		const save = page.getByRole('button', { name: 'Simpan' });
		await expect.element(dialog).toBeInTheDocument();
		await expect.element(cancel).toHaveFocus();

		await save.click();
		await userEvent.keyboard('{Tab}');
		await expect.element(cancel).toHaveFocus();

		await userEvent.keyboard('{Escape}');
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(trigger).toHaveFocus();
	});
});

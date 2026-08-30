import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TabListTestHost from './tab-list-test-host.svelte';

describe('TabList', () => {
	it('exposes tab semantics and supports arrow, Home, and End navigation', async () => {
		render(TabListTestHost);

		const income = page.getByRole('tab', { name: 'Pemasukan' });
		const expense = page.getByRole('tab', { name: 'Pengeluaran' });
		await income.click();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(expense).toHaveFocus();

		await userEvent.keyboard('{Home}');
		await expect.element(income).toHaveFocus();
		await userEvent.keyboard('{End}');
		await expect.element(expense).toHaveFocus();
	});
});

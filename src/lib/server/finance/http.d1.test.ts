import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { debt } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { FinanceError } from './contracts';
import { financeErrorResponse } from './http';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('financeErrorResponse', () => {
	it("logs a failed query without the debt's contact details", async () => {
		const userId = await harness.createUser();
		const row = {
			id: 'debt-1',
			userId,
			type: 'piutang',
			contactName: 'Sri Wahyuni',
			contactPhone: '0812-5555-0101',
			contactAddress: 'Jl. Melati 7',
			originalAmount: 250_000,
			remainingAmount: 250_000,
			date: '2026-11-01'
		};
		await harness.db.insert(debt).values(row);
		const failure = await harness.db
			.insert(debt)
			.values(row)
			.then(
				() => null,
				(error: unknown) => error
			);
		expect(String(failure)).toContain('Sri Wahyuni');

		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const response = financeErrorResponse(failure, 'create debt');
			expect(response.status).toBe(500);
			expect(await response.json()).toEqual({
				error: 'Terjadi kesalahan server',
				code: 'INTERNAL_ERROR'
			});

			const logged = log.mock.calls.flat().map(String).join(' ');
			expect(logged).toContain('create debt');
			expect(logged).toContain('UNIQUE');
			for (const secret of ['Sri Wahyuni', '0812-5555-0101', 'Jl. Melati', userId]) {
				expect(logged).not.toContain(secret);
			}
		} finally {
			log.mockRestore();
		}
	});

	it('answers a FinanceError with its own message and logs nothing', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const response = financeErrorResponse(
				new FinanceError('Saldo tidak mencukupi', 400, 'INSUFFICIENT_BALANCE'),
				'create transfer'
			);
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: 'Saldo tidak mencukupi',
				code: 'INSUFFICIENT_BALANCE'
			});
			expect(log).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
		}
	});
});

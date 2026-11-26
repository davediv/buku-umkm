import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestPasswordReset } = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
vi.mock('$lib/server/auth', () => ({
	getAuth: () => ({ api: { requestPasswordReset } }),
	RESET_PASSWORD_TOKEN_TTL_SECONDS: 3600
}));

import { actions, load } from './+page.server';

type ActionEvent = Parameters<NonNullable<typeof actions.default>>[0];

function requestReset(email: string, platform?: unknown) {
	const formData = new FormData();
	formData.set('email', email);
	const request = new Request('https://buku.test/lupa-kata-sandi', {
		method: 'POST',
		body: formData,
		headers: { 'CF-Connecting-IP': '203.0.113.9' }
	});
	return actions.default!({ request, platform } as unknown as ActionEvent);
}

beforeEach(() => {
	requestPasswordReset.mockReset();
	requestPasswordReset.mockResolvedValue({ status: true });
});

afterEach(() => vi.restoreAllMocks());

describe('forgot password page', () => {
	it('tells the page how long a link stays valid', () => {
		expect(load({} as Parameters<typeof load>[0])).toEqual({ linkLifetimeHours: 1 });
	});

	it('checks the address before asking better-auth for a link', async () => {
		expect(await requestReset('')).toMatchObject({
			status: 400,
			data: { errors: { email: 'Email wajib diisi' } }
		});
		expect(await requestReset('bukan-email')).toMatchObject({
			status: 400,
			data: { errors: { email: 'Email tidak valid' } }
		});
		expect(requestPasswordReset).not.toHaveBeenCalled();
	});

	it('asks better-auth for a reset link and confirms neutrally', async () => {
		expect(await requestReset(' ayu@example.com ')).toEqual({
			sent: true,
			email: 'ayu@example.com'
		});
		expect(requestPasswordReset).toHaveBeenCalledWith({ body: { email: 'ayu@example.com' } });
	});

	it('gives the same answer when better-auth fails, logging no address', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		requestPasswordReset.mockRejectedValue(new Error('D1 unavailable for ayu@example.com'));

		expect(await requestReset('ayu@example.com')).toEqual({
			sent: true,
			email: 'ayu@example.com'
		});
		expect(log.mock.calls.flat().map(String).join(' ')).not.toContain('ayu@example.com');
	});

	it('limits reset links per address on counters of their own', async () => {
		const blocked = { limit: vi.fn(async () => ({ success: false })) };
		const allowed = { limit: vi.fn(async () => ({ success: true })) };

		const result = await requestReset('Ayu@Example.com', {
			env: { MAIL_ADDRESS_RATE_LIMITER: blocked, AUTH_IP_RATE_LIMITER: allowed }
		});

		expect(result).toMatchObject({
			status: 429,
			data: { values: { email: 'Ayu@Example.com' } }
		});
		expect(blocked.limit).toHaveBeenCalledWith({ key: 'mail:ayu@example.com' });
		expect(allowed.limit).toHaveBeenCalledWith({ key: 'mail:203.0.113.9' });
		expect(requestPasswordReset).not.toHaveBeenCalled();
	});
});

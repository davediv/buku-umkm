import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';

const { verifyEmail } = vi.hoisted(() => ({ verifyEmail: vi.fn() }));
vi.mock('#lib/server/auth.ts', () => ({ getAuth: () => ({ api: { verifyEmail } }) }));

import { load } from './+page.server';

function open(search: string) {
	const url = new URL(`https://buku.test/verifikasi-email${search}`);
	return load({
		url,
		request: new Request(url, { headers: { cookie: 'better-auth.session_token=abc' } })
	} as Parameters<typeof load>[0]);
}

beforeEach(() => {
	verifyEmail.mockReset();
	verifyEmail.mockResolvedValue({ status: true, user: null });
});

describe('email verification landing page', () => {
	it('verifies the address with the token and the visitor cookies', async () => {
		expect(await open('?token=jwt-1')).toEqual({ result: 'verified' });

		const [{ query, headers }] = verifyEmail.mock.calls[0];
		expect(query).toEqual({ token: 'jwt-1' });
		expect(new Headers(headers).get('cookie')).toBe('better-auth.session_token=abc');
	});

	it('explains an expired link separately from a broken one', async () => {
		verifyEmail.mockRejectedValueOnce(
			APIError.from('UNAUTHORIZED', { code: 'TOKEN_EXPIRED', message: 'Token expired' })
		);
		expect(await open('?token=old')).toEqual({ result: 'expired' });

		verifyEmail.mockRejectedValueOnce(
			APIError.from('UNAUTHORIZED', { code: 'INVALID_TOKEN', message: 'Invalid token' })
		);
		expect(await open('?token=rusak')).toEqual({ result: 'invalid' });
	});

	it('does not call better-auth without a token', async () => {
		expect(await open('')).toEqual({ result: 'missing' });
		expect(verifyEmail).not.toHaveBeenCalled();
	});

	it('fails the page on an unexpected error without logging the token', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		verifyEmail.mockRejectedValueOnce(new Error('D1 unavailable'));

		await expect(open('?token=rahasia-jwt')).rejects.toMatchObject({ status: 500 });
		expect(log.mock.calls.flat().map(String).join(' ')).not.toContain('rahasia-jwt');
		log.mockRestore();
	});
});

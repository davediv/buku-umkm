import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';

const { resetPassword, isResetPasswordTokenValid } = vi.hoisted(() => ({
	resetPassword: vi.fn(),
	isResetPasswordTokenValid: vi.fn()
}));
vi.mock('#lib/server/auth.ts', () => ({
	getAuth: () => ({ api: { resetPassword } }),
	isResetPasswordTokenValid
}));

import { actions, load } from './+page.server';

type ActionEvent = Parameters<NonNullable<typeof actions.default>>[0];

function loadPage(search: string) {
	return load({
		url: new URL(`https://buku.test/atur-ulang-kata-sandi${search}`)
	} as Parameters<typeof load>[0]);
}

function submit(fields: Record<string, string>, bindings?: Record<string, unknown>) {
	const formData = new FormData();
	for (const [name, value] of Object.entries(fields)) formData.set(name, value);
	const request = new Request('https://buku.test/atur-ulang-kata-sandi', {
		method: 'POST',
		body: formData
	});
	setBindings(bindings);
	return actions.default!({ request } as unknown as ActionEvent);
}

const VALID = { token: 'tok-1', password: 'Rahasia123', confirmPassword: 'Rahasia123' };

beforeEach(() => {
	resetPassword.mockReset();
	resetPassword.mockResolvedValue({ status: true });
	isResetPasswordTokenValid.mockReset();
});

describe('reset password page', () => {
	it('shows the form only for a token that is still usable', async () => {
		isResetPasswordTokenValid.mockImplementation(async (token: string) => token === 'tok-1');

		expect(await loadPage('?token=tok-1')).toEqual({ token: 'tok-1' });
		expect(await loadPage('?token=expired')).toEqual({ token: null });
		expect(await loadPage('')).toEqual({ token: null });
		expect(isResetPasswordTokenValid).toHaveBeenCalledTimes(2);
	});

	it('applies the shared password rule and the confirmation before better-auth', async () => {
		expect(await submit({ ...VALID, password: 'aaaaaaaa', confirmPassword: 'aaaaaaaa' })).toEqual(
			expect.objectContaining({
				status: 400,
				data: {
					errors: { password: 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka' }
				}
			})
		);
		expect(await submit({ ...VALID, confirmPassword: 'Rahasia124' })).toMatchObject({
			status: 400,
			data: { errors: { confirmPassword: 'Kata sandi dan konfirmasi tidak cocok' } }
		});
		expect(resetPassword).not.toHaveBeenCalled();
	});

	it('sets the new password and sends the user to sign in with a notice', async () => {
		await expect(submit(VALID)).rejects.toMatchObject({
			status: 303,
			location: '/masuk?info=kata-sandi-diubah'
		});
		expect(resetPassword).toHaveBeenCalledWith({
			body: { newPassword: 'Rahasia123', token: 'tok-1' }
		});
	});

	it('explains a link that expired or was used while the form was open', async () => {
		resetPassword.mockRejectedValue(
			APIError.from('BAD_REQUEST', { code: 'INVALID_TOKEN', message: 'Invalid token' })
		);
		expect(await submit(VALID)).toMatchObject({ status: 400, data: { invalidToken: true } });
		expect(await submit({ ...VALID, token: '' })).toMatchObject({
			status: 400,
			data: { invalidToken: true }
		});
	});

	it('limits reset attempts per client IP', async () => {
		const blocked = { limit: vi.fn(async () => ({ success: false })) };
		expect(await submit(VALID, { AUTH_IP_RATE_LIMITER: blocked })).toMatchObject({
			status: 429
		});
		expect(resetPassword).not.toHaveBeenCalled();
	});
});

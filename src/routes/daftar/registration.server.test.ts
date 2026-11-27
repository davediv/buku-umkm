import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';

const { signUpEmail } = vi.hoisted(() => ({ signUpEmail: vi.fn() }));
vi.mock('#lib/server/auth.ts', () => ({
	getAuth: () => ({ api: { signUpEmail } })
}));

import { actions } from './+page.server';

type ActionEvent = Parameters<NonNullable<typeof actions.signUpEmail>>[0];

function signUp(password: string, bindings?: Record<string, unknown>) {
	const formData = new FormData();
	formData.set('name', 'Ayu');
	formData.set('email', 'Ayu@Example.com');
	formData.set('password', password);
	formData.set('confirmPassword', password);
	const request = new Request('https://buku.test/daftar?/signUpEmail', {
		method: 'POST',
		body: formData
	});
	setBindings(bindings);
	return actions.signUpEmail!({ request } as unknown as ActionEvent);
}

describe('registration action', () => {
	beforeEach(() => {
		signUpEmail.mockReset();
		signUpEmail.mockResolvedValue({});
	});

	it('applies the shared password policy before calling better-auth', async () => {
		expect(await signUp('aaaaaaaa')).toMatchObject({
			status: 400,
			data: {
				errors: { password: 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka' }
			}
		});
		expect(signUpEmail).not.toHaveBeenCalled();
	});

	it('answers with 429 and keeps the entered values once the limit is reached', async () => {
		const blocked = { limit: vi.fn(async () => ({ success: false })) };
		const result = await signUp('Rahasia123', {
			AUTH_EMAIL_RATE_LIMITER: blocked,
			AUTH_IP_RATE_LIMITER: blocked
		});

		expect(result).toMatchObject({
			status: 429,
			data: {
				message: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.',
				values: { name: 'Ayu', email: 'Ayu@Example.com' }
			}
		});
		expect(blocked.limit).toHaveBeenCalledWith({ key: 'ayu@example.com' });
		expect(signUpEmail).not.toHaveBeenCalled();
	});

	it('registers a valid account and continues to onboarding', async () => {
		await expect(signUp('Rahasia123')).rejects.toMatchObject({ status: 302 });
		expect(signUpEmail).toHaveBeenCalledOnce();
	});
});

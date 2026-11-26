import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth/minimal';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { enforcePasswordPolicy } from './password-policy';

const BASE = 'http://localhost:3000';

function createAuth() {
	return betterAuth({
		baseURL: BASE,
		secret: 'test-secret-0123456789abcdef0123456789',
		database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
		emailAndPassword: { enabled: true },
		hooks: { before: enforcePasswordPolicy },
		logger: { disabled: true }
	});
}

function post(path: string, body: unknown) {
	return new Request(`${BASE}/api/auth${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: BASE },
		body: JSON.stringify(body)
	});
}

describe('better-auth password policy', () => {
	it('rejects a weak password on the public sign-up endpoint with an Indonesian message', async () => {
		const response = await createAuth().handler(
			post('/sign-up/email', { email: 'ayu@example.com', password: 'aaaaaaaa', name: 'Ayu' })
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: 'PASSWORD_POLICY',
			message: 'Kata sandi harus mengandung huruf besar, huruf kecil, dan angka'
		});
	});

	it('accepts a password that meets the policy', async () => {
		const response = await createAuth().handler(
			post('/sign-up/email', { email: 'ayu@example.com', password: 'Rahasia123', name: 'Ayu' })
		);
		expect(response.status).toBe(200);
	});

	it('also applies to server-side auth.api calls', async () => {
		await expect(
			createAuth().api.signUpEmail({
				body: { email: 'budi@example.com', password: 'pendek', name: 'Budi' }
			})
		).rejects.toMatchObject({ status: 'BAD_REQUEST', message: 'Kata sandi minimal 8 karakter' });
	});

	it('checks the new password when resetting or changing it', async () => {
		const auth = createAuth();
		for (const path of ['/reset-password', '/change-password']) {
			const response = await auth.handler(
				post(path, { token: 't', currentPassword: 'Rahasia123', newPassword: 'aaaaaaaa' })
			);
			expect(response.status).toBe(400);
			expect(await response.json()).toMatchObject({ code: 'PASSWORD_POLICY' });
		}
	});
});

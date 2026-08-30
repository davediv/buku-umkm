import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInEmail } = vi.hoisted(() => ({ signInEmail: vi.fn() }));
vi.mock('$lib/server/auth', () => ({
	getAuth: () => ({ api: { signInEmail } })
}));

import { actions, load } from './+page.server';

function signInRequest(returnTo: string): Request {
	const formData = new FormData();
	formData.set('email', 'ayu@example.com');
	formData.set('password', 'Password123');
	formData.set('return_to', returnTo);
	return new Request('https://buku.test/masuk?/signInEmail', {
		method: 'POST',
		body: formData
	});
}

describe('login navigation continuity', () => {
	beforeEach(() => {
		signInEmail.mockReset();
		signInEmail.mockResolvedValue({});
	});

	it('exposes a safe requested destination to the login form', async () => {
		const result = await load({
			locals: {},
			url: new URL('https://buku.test/masuk?return_to=%2Ftransaksi%3Fq%3Dkopi%26page%3D3')
		} as Parameters<typeof load>[0]);

		expect(result).toEqual({
			returnTo: '/transaksi?q=kopi&page=3',
			registrationHref: '/daftar?return_to=%2Ftransaksi%3Fq%3Dkopi%26page%3D3'
		});
	});

	it('redirects to the validated destination after authentication', async () => {
		const action = actions.signInEmail!;
		await expect(
			action({ request: signInRequest('/laporan/neraca?date=2026-08-30') } as Parameters<
				typeof action
			>[0])
		).rejects.toMatchObject({
			status: 302,
			location: '/laporan/neraca?date=2026-08-30'
		});
		expect(signInEmail).toHaveBeenCalledWith({
			body: {
				email: 'ayu@example.com',
				password: 'Password123',
				callbackURL: '/laporan/neraca?date=2026-08-30'
			}
		});
	});

	it('falls back to the dashboard for an unsafe posted destination', async () => {
		const action = actions.signInEmail!;
		await expect(
			action({ request: signInRequest('https://evil.example/collect') } as Parameters<
				typeof action
			>[0])
		).rejects.toMatchObject({ status: 302, location: '/beranda' });
	});
});

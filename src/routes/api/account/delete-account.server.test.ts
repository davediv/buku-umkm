import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }));
vi.mock('#lib/server/auth.ts', () => ({ getAuth: () => ({ api: { deleteUser } }) }));

import { DELETE } from './+server';

type Event = Parameters<typeof DELETE>[0];

const USER = { id: 'u1', email: 'ayu@example.com' };

function remove(
	body: unknown,
	{ signedIn = true, bindings }: { signedIn?: boolean; bindings?: Record<string, unknown> } = {}
) {
	const request = new Request('https://buku.test/api/account', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json', cookie: 'better-auth.session_token=abc' },
		body: JSON.stringify(body)
	});
	setBindings(bindings);
	return DELETE({
		request,
		locals: signedIn ? { user: USER, session: { id: 's1' } } : {}
	} as unknown as Event);
}

beforeEach(() => {
	deleteUser.mockReset();
	deleteUser.mockResolvedValue({ success: true, message: 'User deleted' });
});

describe('DELETE /api/account', () => {
	it('deletes the account with the password and the session cookie', async () => {
		const response = await remove({ password: 'Rahasia123', confirmation: ' hapus ' });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		const [{ body, headers }] = deleteUser.mock.calls[0];
		expect(body).toEqual({ password: 'Rahasia123' });
		expect(new Headers(headers).get('cookie')).toBe('better-auth.session_token=abc');
	});

	it('requires the confirmation word and the password before asking better-auth', async () => {
		const noWord = await remove({ password: 'Rahasia123', confirmation: 'hapus akun' });
		expect(noWord.status).toBe(400);
		expect(await noWord.json()).toEqual({
			error: 'Ketik HAPUS untuk mengonfirmasi.',
			field: 'confirmation'
		});

		const noPassword = await remove({ confirmation: 'HAPUS' });
		expect(noPassword.status).toBe(400);
		expect(await noPassword.json()).toMatchObject({ field: 'password' });

		expect((await remove('bukan json')).status).toBe(400);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it('refuses a request without a session', async () => {
		expect((await remove({}, { signedIn: false })).status).toBe(401);
	});

	it('reports a wrong password on the password field', async () => {
		deleteUser.mockRejectedValue(
			APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'Invalid password' })
		);
		const response = await remove({ password: 'Salah', confirmation: 'HAPUS' });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Kata sandi salah', field: 'password' });
	});

	it('says the account was kept when the receipt photos could not be deleted', async () => {
		deleteUser.mockRejectedValue(
			APIError.from('SERVICE_UNAVAILABLE', {
				code: 'RECEIPTS_NOT_DELETED',
				message: 'Foto nota belum dapat dihapus, jadi akun belum dihapus. Coba lagi.'
			})
		);
		const response = await remove({ password: 'Rahasia123', confirmation: 'HAPUS' });

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: 'Foto nota belum dapat dihapus, jadi akun belum dihapus. Coba lagi.'
		});
	});

	it('counts each attempt against the account like a sign-in', async () => {
		const blocked = { limit: vi.fn(async () => ({ success: false })) };
		const allowed = { limit: vi.fn(async () => ({ success: true })) };
		const response = await remove(
			{ password: 'Rahasia123', confirmation: 'HAPUS' },
			{ bindings: { AUTH_EMAIL_RATE_LIMITER: blocked, AUTH_IP_RATE_LIMITER: allowed } }
		);

		expect(response.status).toBe(429);
		expect(blocked.limit).toHaveBeenCalledWith({ key: 'ayu@example.com' });
		expect(deleteUser).not.toHaveBeenCalled();
	});
});

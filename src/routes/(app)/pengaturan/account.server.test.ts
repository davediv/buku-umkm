import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';
import { EmailNotSentError } from '#lib/server/email/send.ts';
import { setBindings } from '#lib/server/testing/cloudflare-workers.ts';

const { sendVerificationEmail } = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));
vi.mock('#lib/server/auth.ts', () => ({ getAuth: () => ({ api: { sendVerificationEmail } }) }));

import { actions } from './+page.server';

type ActionEvent = Parameters<NonNullable<typeof actions.resendVerification>>[0];

const USER = { id: 'u1', email: 'ayu@example.com', emailVerified: false };

function resend(user: Partial<typeof USER> | null = USER, bindings?: Record<string, unknown>) {
	const request = new Request('https://buku.test/pengaturan?bagian=akun&/resendVerification', {
		method: 'POST',
		headers: { cookie: 'better-auth.session_token=abc', 'CF-Connecting-IP': '203.0.113.5' }
	});
	setBindings(bindings);
	return actions.resendVerification!({
		request,
		locals: { user: user ?? undefined }
	} as unknown as ActionEvent);
}

beforeEach(() => {
	sendVerificationEmail.mockReset();
	sendVerificationEmail.mockResolvedValue({ status: true });
});

describe('resend verification email', () => {
	it("sends a new link to the signed-in user's own address with their session", async () => {
		expect(await resend()).toEqual({ verification: { sent: true } });

		const [{ body, headers }] = sendVerificationEmail.mock.calls[0];
		expect(body).toEqual({ email: 'ayu@example.com' });
		expect(new Headers(headers).get('cookie')).toBe('better-auth.session_token=abc');
	});

	it('does nothing for an address that is already verified', async () => {
		expect(await resend({ ...USER, emailVerified: true })).toEqual({
			verification: { alreadyVerified: true }
		});
		sendVerificationEmail.mockRejectedValueOnce(
			APIError.from('BAD_REQUEST', {
				code: 'EMAIL_ALREADY_VERIFIED',
				message: 'Email is already verified'
			})
		);
		expect(await resend()).toEqual({ verification: { alreadyVerified: true } });
	});

	it('is limited per address on the email counters', async () => {
		const blocked = { limit: vi.fn(async () => ({ success: false })) };
		const allowed = { limit: vi.fn(async () => ({ success: true })) };

		expect(
			await resend(USER, { MAIL_ADDRESS_RATE_LIMITER: blocked, AUTH_IP_RATE_LIMITER: allowed })
		).toMatchObject({ status: 429 });
		expect(blocked.limit).toHaveBeenCalledWith({ key: 'mail:ayu@example.com' });
		expect(sendVerificationEmail).not.toHaveBeenCalled();
	});

	it('says so when the email could not be sent', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		sendVerificationEmail.mockRejectedValueOnce(new EmailNotSentError('email-verification'));

		expect(await resend()).toMatchObject({
			status: 503,
			data: {
				verification: {
					error: 'Email verifikasi belum dapat dikirim. Coba lagi beberapa saat lagi.'
				}
			}
		});
		expect(log.mock.calls.flat().map(String).join(' ')).not.toContain('ayu@example.com');
		log.mockRestore();
	});

	it('refuses a request without a session', async () => {
		expect(await resend(null)).toMatchObject({ status: 401 });
	});
});

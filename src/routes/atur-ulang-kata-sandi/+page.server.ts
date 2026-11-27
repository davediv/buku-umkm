import { error as httpError, fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { loginNoticeHref } from '#lib/server/account/login-notice.ts';
import { getAuth, isResetPasswordTokenValid } from '#lib/server/auth.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import {
	CREDENTIAL_RATE_LIMIT_MESSAGE,
	isCredentialAttemptAllowed
} from '#lib/server/security/rate-limit.ts';
import { validateNewPassword, type NewPasswordErrors } from './new-password';

/** better-auth error codes that mean the link can no longer be used. */
const UNUSABLE_TOKEN_CODES = new Set(['INVALID_TOKEN', 'USER_NOT_FOUND']);

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	if (!token) return { token: null };

	try {
		return { token: (await isResetPasswordTokenValid(token)) ? token : null };
	} catch (cause) {
		console.error('Password reset token check failed', summarizeError(cause));
		throw httpError(500, 'Tautan tidak dapat diperiksa. Coba lagi beberapa saat lagi.');
	}
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const token = formData.get('token')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		if (!token) return fail(400, { invalidToken: true });

		const errors = validateNewPassword(password, confirmPassword);
		if (Object.keys(errors).length > 0) return fail(400, { errors });

		// The token is the credential here, so only the client IP is counted.
		if (!(await isCredentialAttemptAllowed(event, null))) {
			return fail(429, { message: CREDENTIAL_RATE_LIMIT_MESSAGE });
		}

		try {
			// Also signs the account out everywhere (revokeSessionsOnPasswordReset).
			await getAuth().api.resetPassword({ body: { newPassword: password, token } });
		} catch (cause) {
			if (cause instanceof APIError) {
				const code = cause.body?.code;
				if (code && UNUSABLE_TOKEN_CODES.has(code)) return fail(400, { invalidToken: true });
				if (code === 'PASSWORD_POLICY') {
					const errors: NewPasswordErrors = { password: cause.message };
					return fail(400, { errors });
				}
			}
			console.error('Password reset failed', summarizeError(cause));
			return fail(500, { message: 'Terjadi kesalahan server. Kata sandi belum diubah.' });
		}

		return redirect(303, loginNoticeHref('kata-sandi-diubah'));
	}
};

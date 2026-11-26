import { APIError, createAuthMiddleware } from 'better-auth/api';
import { getPasswordError } from '$lib/shared/password';

/** better-auth endpoints that set a password, and the body field that carries it. */
const PASSWORD_FIELD_BY_PATH: Record<string, string> = {
	'/sign-up/email': 'password',
	'/reset-password': 'newPassword',
	'/change-password': 'newPassword'
};

/**
 * better-auth endpoints that must check the current password even where better-auth would
 * accept a recent session instead: deleting the account is never one click away for whoever
 * holds an unlocked phone.
 */
const CURRENT_PASSWORD_REQUIRED_PATHS = new Set(['/delete-user']);

/**
 * better-auth `hooks.before` middleware. better-auth only checks password length, and its
 * endpoints are reachable directly (POST /api/auth/sign-up/email), so the app's policy is
 * enforced here as well as in the /daftar form. It also runs for server-side `auth.api` calls.
 */
export const enforcePasswordPolicy = createAuthMiddleware(async (ctx) => {
	const body = ctx.body as Record<string, unknown> | undefined;
	if (CURRENT_PASSWORD_REQUIRED_PATHS.has(ctx.path)) {
		const current = body?.password;
		if (typeof current !== 'string' || !current) {
			throw new APIError('BAD_REQUEST', {
				code: 'PASSWORD_REQUIRED',
				message: 'Kata sandi wajib diisi'
			});
		}
		return;
	}

	const field = PASSWORD_FIELD_BY_PATH[ctx.path];
	if (!field) return;

	const password = body?.[field];
	const message = getPasswordError(typeof password === 'string' ? password : '');
	if (message) throw new APIError('BAD_REQUEST', { code: 'PASSWORD_POLICY', message });
});

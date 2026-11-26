import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { deleteUserOptions } from '$lib/server/account/deletion';
import { markEmailVerifiedAfterReset } from '$lib/server/account/verification';
import { getDb } from '$lib/server/db';
import { passwordResetEmail, verificationEmail } from '$lib/server/email/messages';
import { EmailNotSentError, sendAccountEmail } from '$lib/server/email/send';
import { enforcePasswordPolicy } from '$lib/server/security/password-policy';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '$lib/shared/password';

/** How long a password reset link stays valid. */
export const RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60;
/** The page a password reset email links to (src/routes/atur-ulang-kata-sandi). */
const RESET_PASSWORD_PATH = '/atur-ulang-kata-sandi';
/** How long an email verification link stays valid. */
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
/** The page a verification email links to (src/routes/verifikasi-email). */
const VERIFY_EMAIL_PATH = '/verifikasi-email';

/**
 * A link to one of the app's pages carrying `token`. better-auth's own `url` points at its
 * /api/auth callback; only its origin is kept, so links follow the configured baseURL.
 */
function pageLink(authUrl: string, pathname: string, token: string): string {
	const link = new URL(pathname, authUrl);
	link.searchParams.set('token', token);
	return link.href;
}

/**
 * Lets better-auth send mail after the response (Workers `waitUntil`): a reset request then
 * answers equally fast whether or not the address has an account.
 */
function runAfterResponse(task: Promise<unknown>): void {
	try {
		getRequestEvent().platform?.ctx.waitUntil(task);
	} catch {
		// Outside a request there is nothing to extend; the task still runs to completion.
	}
}

function createAuth() {
	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(), { provider: 'sqlite' }),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			maxPasswordLength: PASSWORD_MAX_LENGTH,
			resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
			// A reset is how someone takes back an account: sign every device out.
			revokeSessionsOnPasswordReset: true,
			async sendResetPassword({ user, url, token }) {
				await sendAccountEmail(
					user.email,
					passwordResetEmail(
						pageLink(url, RESET_PASSWORD_PATH, token),
						RESET_PASSWORD_TOKEN_TTL_SECONDS
					)
				);
			},
			onPasswordReset: ({ user }) => markEmailVerifiedAfterReset(getDb(), user)
		},
		// Verification is soft (the owner's decision): an unverified user keeps full access to
		// their books, so requireEmailVerification stays off and sign-in never checks it.
		emailVerification: {
			sendOnSignUp: true,
			// Off on purpose: someone may sign up with another person's address. If the link
			// signed its opener in, the real owner would land in an account whose password the
			// stranger knows. They sign in (or reset the password) themselves instead.
			autoSignInAfterVerification: false,
			expiresIn: EMAIL_VERIFICATION_TTL_SECONDS,
			async sendVerificationEmail({ user, url, token }) {
				const sent = await sendAccountEmail(
					user.email,
					verificationEmail(pageLink(url, VERIFY_EMAIL_PATH, token), EMAIL_VERIFICATION_TTL_SECONDS)
				);
				// Lets the resend button in Pengaturan say so; on sign-up better-auth only logs it.
				if (!sent) throw new EmailNotSentError('email-verification');
			}
		},
		// Pengaturan > Hapus akun (DELETE /api/account). The password is always required (see
		// enforcePasswordPolicy); the hooks delete the user's receipt photos from R2.
		user: {
			deleteUser: deleteUserOptions({
				getBucket: () => getRequestEvent().platform?.env?.R2,
				getDb
			})
		},
		hooks: { before: enforcePasswordPolicy },
		advanced: { backgroundTasks: { handler: runAfterResponse } },
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

type AuthInstance = ReturnType<typeof createAuth>;

// Lazy initialization singleton for better-auth
let authInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
	authInstance ??= createAuth();
	return authInstance;
}

/**
 * Whether a password reset token is still usable, without spending it, so the reset page can
 * say a link has expired before the user types a new password. Mirrors the lookup that
 * better-auth's /reset-password endpoint makes.
 */
export async function isResetPasswordTokenValid(token: string): Promise<boolean> {
	const { internalAdapter } = await getAuth().$context;
	const verification = await internalAdapter.findVerificationValue(`reset-password:${token}`);
	return !!verification && verification.expiresAt > new Date();
}

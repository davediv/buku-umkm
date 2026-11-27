import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth, RESET_PASSWORD_TOKEN_TTL_SECONDS } from '#lib/server/auth.ts';
import { redactEmailAddresses } from '#lib/server/email/send.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import {
	EMAIL_RATE_LIMIT_MESSAGE,
	isEmailRequestAllowed
} from '#lib/server/security/rate-limit.ts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const load: PageServerLoad = () => ({
	linkLifetimeHours: RESET_PASSWORD_TOKEN_TTL_SECONDS / 3600
});

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';

		if (!email) {
			return fail(400, { errors: { email: 'Email wajib diisi' }, values: { email } });
		}
		if (!EMAIL_PATTERN.test(email)) {
			return fail(400, { errors: { email: 'Email tidak valid' }, values: { email } });
		}

		if (!(await isEmailRequestAllowed(event, email))) {
			return fail(429, { message: EMAIL_RATE_LIMIT_MESSAGE, values: { email } });
		}

		try {
			// better-auth answers the same whether or not the address has an account, and sends
			// the email after the response (see runAfterResponse in $lib/server/auth).
			await getAuth().api.requestPasswordReset({ body: { email } });
		} catch (error) {
			// Any failure gets the same answer as success: a different one for some addresses
			// would tell which of them are registered.
			console.error('Password reset request failed', redactEmailAddresses(summarizeError(error)));
		}

		return { sent: true, email };
	}
};

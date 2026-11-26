import { error as httpError, fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';
import { decryptNPWP, formatNPWP } from '$lib/server/crypto';
import { summarizeError } from '$lib/server/error-summary';
import { EMAIL_RATE_LIMIT_MESSAGE, isEmailRequestAllowed } from '$lib/server/security/rate-limit';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const db = getDb();
	const userId = locals.user.id;

	// Get business profile
	let profile = null;
	try {
		profile = await businessProfileQueries.findByUserId(db, userId);
	} catch (cause) {
		console.error('Error fetching profile', cause);
		throw httpError(500, 'Profil usaha tidak dapat dimuat. Data Anda tidak diubah.');
	}

	// Decrypt NPWP for display
	let displayNpwp: string | null = null;
	if (profile?.npwp) {
		try {
			const decrypted = await decryptNPWP(profile.npwp);
			displayNpwp = decrypted ? formatNPWP(decrypted) : null;
		} catch (cause) {
			console.error('Error decrypting NPWP', cause);
			throw httpError(500, 'NPWP tidak dapat dimuat dengan aman. Data Anda tidak diubah.');
		}
	}

	return {
		user: {
			email: locals.user.email,
			emailVerified: locals.user.emailVerified
		},
		profile: profile
			? {
					id: profile.id,
					name: profile.name,
					businessType: profile.businessType,
					address: profile.address,
					phone: profile.phone,
					npwp: displayNpwp,
					ownerName: profile.ownerName,
					industry: profile.industry
				}
			: null
	};
};

/** What the "Kirim ulang email verifikasi" button reports back. */
interface VerificationOutcome {
	sent?: boolean;
	alreadyVerified?: boolean;
	error?: string;
}

function verification(outcome: VerificationOutcome) {
	return { verification: outcome };
}

export const actions: Actions = {
	/** Sends a new verification link to the signed-in user's address. */
	resendVerification: async (event) => {
		const user = event.locals.user;
		if (!user) return fail(401, verification({ error: 'Sesi berakhir. Silakan masuk kembali.' }));
		if (user.emailVerified) return verification({ alreadyVerified: true });

		if (!(await isEmailRequestAllowed(event, user.email))) {
			return fail(429, verification({ error: EMAIL_RATE_LIMIT_MESSAGE }));
		}

		try {
			await getAuth().api.sendVerificationEmail({
				body: { email: user.email },
				headers: event.request.headers
			});
		} catch (cause) {
			if (cause instanceof APIError && cause.body?.code === 'EMAIL_ALREADY_VERIFIED') {
				return verification({ alreadyVerified: true });
			}
			console.error('Verification email resend failed', summarizeError(cause));
			return fail(
				503,
				verification({
					error: 'Email verifikasi belum dapat dikirim. Coba lagi beberapa saat lagi.'
				})
			);
		}

		return verification({ sent: true });
	}
};

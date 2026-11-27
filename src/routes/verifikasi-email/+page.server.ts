import { error as httpError } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { PageServerLoad } from './$types';
import { getAuth } from '#lib/server/auth.ts';
import { summarizeError } from '#lib/server/error-summary.ts';

type VerificationResult = 'verified' | 'expired' | 'invalid' | 'missing';

/** better-auth error codes for a link that cannot verify anything. */
const INVALID_LINK_CODES = new Set(['INVALID_TOKEN', 'USER_NOT_FOUND']);

/**
 * The page a verification email links to. Opening it verifies the address (a link that was
 * already used still counts as verified) and, with autoSignInAfterVerification, signs the user
 * in when they were not; better-auth's cookies reach this response through sveltekitCookies.
 */
export const load: PageServerLoad = async ({ url, request }) => {
	const token = url.searchParams.get('token');
	if (!token) return { result: 'missing' as VerificationResult };

	try {
		await getAuth().api.verifyEmail({ query: { token }, headers: request.headers });
		return { result: 'verified' as VerificationResult };
	} catch (cause) {
		if (cause instanceof APIError) {
			const code = cause.body?.code;
			if (code === 'TOKEN_EXPIRED') return { result: 'expired' as VerificationResult };
			if (code && INVALID_LINK_CODES.has(code)) return { result: 'invalid' as VerificationResult };
		}
		console.error('Email verification failed', summarizeError(cause));
		throw httpError(
			500,
			'Email belum dapat diverifikasi. Coba buka tautan lagi beberapa saat lagi.'
		);
	}
};

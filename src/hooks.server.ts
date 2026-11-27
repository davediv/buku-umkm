import { redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { getAuth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getLoginHref } from '#lib/navigation/return-to.ts';
import { isCrossSiteRequest } from '#lib/server/security/csrf.ts';
import { limitRequest } from '#lib/server/security/rate-limit.ts';

// ============================================
// Rate Limiting Handler
// ============================================

// Runs after handleSession so /api/* limits can be counted per signed-in user. The /masuk and
// /daftar form actions limit their own attempts, keyed on the submitted email.
const handleRateLimit: Handle = async ({ event, resolve }) => {
	return (await limitRequest(event)) ?? resolve(event);
};

// ============================================
// Security Headers Handler
// ============================================

// The Content-Security-Policy is set by SvelteKit (`csp` in the sveltekit() options in
// vite.config.ts) so that pages get a nonce for SvelteKit's inline scripts.
const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()'
	);
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	return response;
};

// ============================================
// CSRF Protection Handler
// ============================================

// Covers form actions, the app's API and better-auth's endpoints alike.
const handleCSRF: Handle = async ({ event, resolve }) => {
	if (isCrossSiteRequest(event.request, event.url)) {
		return new Response('Forbidden', { status: 403 });
	}
	return resolve(event);
};

// ============================================
// Auth Handlers
// ============================================

const handleSession: Handle = async ({ event, resolve }) => {
	const session = await getAuth().api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	if (!session && event.route.id?.startsWith('/(app)')) {
		throw redirect(302, getLoginHref(`${event.url.pathname}${event.url.search}`));
	}

	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth: getAuth(), building });
};

export const handle = sequence(
	handleCSRF,
	handleSecurityHeaders,
	handleSession,
	handleRateLimit,
	handleBetterAuth
);

import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getLoginHref } from '$lib/navigation/return-to';
import { limitRequest } from '$lib/server/security/rate-limit';

// ============================================
// Constants
// ============================================

const CLOUDFLARE_STORAGE_DOMAINS =
	'https://*.cloudflarestorage.com https://*.r2.cloudflarestorage.com';

// ============================================
// Rate Limiting Handler
// ============================================

// Runs after handleSession so /api/* limits can be counted per signed-in user. The /masuk and
// /daftar form actions limit their own attempts, keyed on the submitted email.
const handleRateLimit: Handle = async ({ event, resolve }) => {
	return (await limitRequest(event)) ?? resolve(event);
};

// ============================================
// CSP Handler
// ============================================

const handleCSP: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Content Security Policy headers
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
			"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
			`img-src 'self' data: blob: ${CLOUDFLARE_STORAGE_DOMAINS}`,
			"font-src 'self' data: https://fonts.gstatic.com",
			`connect-src 'self' ${CLOUDFLARE_STORAGE_DOMAINS}`,
			"frame-src 'none'",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ')
	);

	// Security headers
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

const handleCSRF: Handle = async ({ event, resolve }) => {
	const method = event.request.method;
	// Only check state-changing methods
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
		return resolve(event);
	}

	const origin = event.request.headers.get('origin');
	if (origin) {
		const requestUrl = new URL(event.url);
		const originUrl = new URL(origin);
		if (originUrl.origin !== requestUrl.origin) {
			return new Response('Forbidden', { status: 403 });
		}
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
	handleCSP,
	handleSession,
	handleRateLimit,
	handleBetterAuth
);

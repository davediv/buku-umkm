import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// ============================================
// Constants
// ============================================

const API_PATH = '/api/';
const AUTH_API_PATH = '/api/auth/';

const RATE_LIMITS = {
	auth: { requests: 5, window: 60 },
	api: { requests: 60, window: 60 },
	heavy: { requests: 3, window: 300 }
} as const;

const CLOUDFLARE_STORAGE_DOMAINS =
	'https://*.cloudflarestorage.com https://*.r2.cloudflarestorage.com';

const HEAVY_ENDPOINTS = ['/api/sync', '/api/restore', '/api/backup'];

// ============================================
// Helper Functions
// ============================================

/** Get client IP address from request headers (Cloudflare-only) */
function getClientIP(headers: globalThis.Headers): string {
	// Only trust CF-Connecting-IP set by Cloudflare infrastructure
	return headers.get('CF-Connecting-IP') || 'unknown';
}

// ============================================
// Rate Limiting Handler
// ============================================

const handleRateLimit: Handle = async ({ event, resolve }) => {
	const path = event.request.url;
	const kv = event.platform?.env?.KV;

	// Only apply rate limiting to API endpoints when KV is available
	if (!path.includes(API_PATH) || !kv) {
		return resolve(event);
	}

	const isAuthEndpoint = path.includes(AUTH_API_PATH);
	const isHeavyEndpoint = HEAVY_ENDPOINTS.some((ep) => path.includes(ep));
	const limit = isAuthEndpoint
		? RATE_LIMITS.auth
		: isHeavyEndpoint
			? RATE_LIMITS.heavy
			: RATE_LIMITS.api;

	const ip = getClientIP(event.request.headers);
	const key = `rate:${ip}:${isAuthEndpoint ? 'auth' : isHeavyEndpoint ? 'heavy' : 'api'}`;

	try {
		const current = await kv.get(key);
		const count = current ? parseInt(current, 10) : 0;

		if (count >= limit.requests) {
			return new Response('Too Many Requests', {
				status: 429,
				headers: {
					'Retry-After': String(limit.window),
					'X-RateLimit-Limit': String(limit.requests),
					'X-RateLimit-Remaining': '0'
				}
			});
		}

		await kv.put(key, String(count + 1), { expirationTtl: limit.window });
	} catch {
		// Fail closed for auth endpoints to prevent brute force during KV outage
		if (isAuthEndpoint) {
			console.error('Rate limiting KV unavailable on auth endpoint');
			return new Response('Service temporarily unavailable', { status: 503 });
		}
		console.error('Rate limiting KV error');
	}

	const response = await resolve(event);
	response.headers.set('X-RateLimit-Limit', String(limit.requests));

	return response;
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
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	return response;
};

// ============================================
// Auth Handler
// ============================================

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const auth = getAuth();
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle = sequence(handleRateLimit, handleCSP, handleBetterAuth);

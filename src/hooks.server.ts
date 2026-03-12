import type { Handle } from '@sveltejs/kit';
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
	api: { requests: 60, window: 60 }
} as const;

const CLOUDFLARE_STORAGE_DOMAINS =
	'https://*.cloudflarestorage.com https://*.r2.cloudflarestorage.com';

// ============================================
// Helper Functions
// ============================================

/** Get client IP address from request headers (Cloudflare-aware) */
function getClientIP(headers: globalThis.Headers): string {
	return headers.get('CF-Connecting-IP') || headers.get('X-Forwarded-For') || 'unknown';
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
	const limit = isAuthEndpoint ? RATE_LIMITS.auth : RATE_LIMITS.api;

	const ip = getClientIP(event.request.headers);
	const key = `rate:${ip}:${isAuthEndpoint ? 'auth' : 'api'}`;

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
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
			"style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
			`img-src 'self' data: blob: ${CLOUDFLARE_STORAGE_DOMAINS}`,
			"font-src 'self' data:",
			`connect-src 'self' ${CLOUDFLARE_STORAGE_DOMAINS}`,
			"frame-src 'none'",
			"object-src 'none'",
			"base-uri 'self'"
		].join('; ')
	);

	// Additional security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

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

export const handle: Handle[] = [handleRateLimit, handleCSP, handleBetterAuth];

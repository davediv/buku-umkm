/**
 * Request rate limiting on Cloudflare Workers Rate Limiting bindings (`ratelimits` in
 * wrangler.jsonc). Counters are kept per Cloudflare location and are eventually consistent, so
 * these limits are a brake on password guessing and abuse, not an exact quota.
 *
 * - Credential attempts (the /masuk and /daftar form actions and better-auth's sign-in, sign-up
 *   and password endpoints) are limited per account (normalized email) and, more loosely, per
 *   client IP: many Indonesian mobile users share one carrier IP.
 * - Requests that send an account email (a password reset or verification link) are limited the
 *   same way but on their own counters, so someone locked out by failed sign-ins can still ask
 *   for a reset link, and a stranger cannot flood one inbox faster than the per-address limit.
 * - Every other /api/* request is limited per signed-in user, or per IP when signed out, with a
 *   much tighter limit on backup and restore.
 */

/** The `simple.period` every binding in wrangler.jsonc uses. */
export const RATE_LIMIT_PERIOD_SECONDS = 60;

export const CREDENTIAL_RATE_LIMIT_MESSAGE = 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.';
export const API_RATE_LIMIT_MESSAGE = 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.';
export const EMAIL_RATE_LIMIT_MESSAGE =
	'Terlalu banyak permintaan email. Tunggu 1 menit sebelum mencoba lagi.';

type LimiterName =
	| 'AUTH_EMAIL_RATE_LIMITER'
	| 'AUTH_IP_RATE_LIMITER'
	| 'API_RATE_LIMITER'
	| 'HEAVY_API_RATE_LIMITER';

export type RateLimitEnv = Partial<Record<LimiterName, Pick<RateLimit, 'limit'>>>;

interface RateLimitEvent {
	request: Request;
	platform?: { env?: RateLimitEnv };
}

interface RateLimitRequestEvent extends RateLimitEvent {
	url: URL;
	locals: { user?: { id: string; email: string } };
}

const AUTH_API_PREFIX = '/api/auth/';
/** better-auth endpoints that check or set a password (trailing / = prefix). */
const CREDENTIAL_AUTH_ENDPOINTS = [
	'sign-in/',
	'sign-up/',
	'reset-password',
	'change-password',
	'delete-user'
];
/** better-auth endpoints that send an email to the address in their body. */
const EMAIL_AUTH_ENDPOINTS = ['request-password-reset', 'send-verification-email'];
/** Key prefix that keeps email-sending requests on their own counters. */
const EMAIL_KEY_PREFIX = 'mail:';
const HEAVY_API_PATHS = ['/api/backup', '/api/restore'];

const reportedMissing = new Set<LimiterName>();

/** Returns whether the request may proceed; a missing or failing binding never blocks it. */
async function consume(
	env: RateLimitEnv | undefined,
	name: LimiterName,
	key: string
): Promise<boolean> {
	const limiter = env?.[name];
	if (!limiter) {
		if (!reportedMissing.has(name)) {
			reportedMissing.add(name);
			console.warn(`Rate limiter binding ${name} is not configured; requests are not limited.`);
		}
		return true;
	}
	try {
		return (await limiter.limit({ key })).success;
	} catch (error) {
		console.error(`Rate limiter ${name} failed; allowing the request.`, error);
		return true;
	}
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * The client as Cloudflare sees it. An IPv6 subscriber usually controls a whole /64, so the
 * prefix is counted instead of the address; otherwise one device could rotate past the limit.
 */
export function clientKey(request: Request): string {
	const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
	if (!ip.includes(':') || ip.includes('.')) return ip;

	const [head, tail] = ip.toLowerCase().split('::');
	const headGroups = head ? head.split(':') : [];
	const tailGroups = tail ? tail.split(':') : [];
	const zeros = Array<string>(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill('0');
	const groups = tail === undefined ? headGroups : [...headGroups, ...zeros, ...tailGroups];
	return `${groups
		.slice(0, 4)
		.map((group) => group.replace(/^0+(?=.)/, ''))
		.join(':')}::/64`;
}

function isAuthEndpoint(method: string, pathname: string, endpoints: string[]): boolean {
	if (method !== 'POST' || !pathname.startsWith(AUTH_API_PREFIX)) return false;
	const endpoint = pathname.slice(AUTH_API_PREFIX.length);
	return endpoints.some((name) =>
		name.endsWith('/') ? endpoint.startsWith(name) : endpoint === name
	);
}

export function isCredentialAuthRequest(method: string, pathname: string): boolean {
	return isAuthEndpoint(method, pathname, CREDENTIAL_AUTH_ENDPOINTS);
}

export function isEmailAuthRequest(method: string, pathname: string): boolean {
	return isAuthEndpoint(method, pathname, EMAIL_AUTH_ENDPOINTS);
}

function isHeavyApiPath(pathname: string): boolean {
	return HEAVY_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

async function isAllowedForClientAndAccount(
	event: RateLimitEvent,
	email: string | null | undefined,
	keyPrefix: string
): Promise<boolean> {
	const env = event.platform?.env;
	const account = email ? normalizeEmail(email) : '';
	const checks = [consume(env, 'AUTH_IP_RATE_LIMITER', keyPrefix + clientKey(event.request))];
	if (account) checks.push(consume(env, 'AUTH_EMAIL_RATE_LIMITER', keyPrefix + account));
	return (await Promise.all(checks)).every(Boolean);
}

/**
 * Counts one credential attempt against the client IP and, when known, the account. Returns
 * false when either limit is exceeded.
 */
export function isCredentialAttemptAllowed(
	event: RateLimitEvent,
	email: string | null | undefined
): Promise<boolean> {
	return isAllowedForClientAndAccount(event, email, '');
}

/**
 * Counts one request that sends an account email to `email` against the client IP and that
 * address, on counters separate from credential attempts. Returns false when either limit is
 * exceeded.
 */
export function isEmailRequestAllowed(
	event: RateLimitEvent,
	email: string | null | undefined
): Promise<boolean> {
	return isAllowedForClientAndAccount(event, email, EMAIL_KEY_PREFIX);
}

export function tooManyRequests(message: string): Response {
	// `error` is what the app's fetch callers read; `message` matches better-auth's error shape.
	return new Response(JSON.stringify({ error: message, message }), {
		status: 429,
		headers: {
			'Content-Type': 'application/json',
			'Retry-After': String(RATE_LIMIT_PERIOD_SECONDS)
		}
	});
}

async function readBodyEmail(request: Request): Promise<string | null> {
	const contentType = request.headers.get('content-type') ?? '';
	try {
		let email: unknown = null;
		if (contentType.includes('application/json')) {
			email = ((await request.clone().json()) as { email?: unknown } | null)?.email;
		} else if (contentType.includes('form')) {
			email = (await request.clone().formData()).get('email');
		}
		return typeof email === 'string' ? email : null;
	} catch {
		// better-auth rejects an unreadable body itself; the per-IP limit still applies.
		return null;
	}
}

/**
 * Applies the limits that can be decided from the request alone (better-auth credential and
 * email endpoints and /api/*). Form actions call {@link isCredentialAttemptAllowed} or
 * {@link isEmailRequestAllowed} themselves.
 * Returns the 429 response to send, or null to continue.
 */
export async function limitRequest(event: RateLimitRequestEvent): Promise<Response | null> {
	const { pathname } = event.url;
	if (isCredentialAuthRequest(event.request.method, pathname)) {
		// change-password and delete-user have no email in their body; they belong to the
		// signed-in account.
		const email = (await readBodyEmail(event.request)) ?? event.locals.user?.email;
		return (await isCredentialAttemptAllowed(event, email))
			? null
			: tooManyRequests(CREDENTIAL_RATE_LIMIT_MESSAGE);
	}
	if (isEmailAuthRequest(event.request.method, pathname)) {
		const email = (await readBodyEmail(event.request)) ?? event.locals.user?.email;
		return (await isEmailRequestAllowed(event, email))
			? null
			: tooManyRequests(EMAIL_RATE_LIMIT_MESSAGE);
	}

	if (!pathname.startsWith('/api/')) return null;
	const userId = event.locals.user?.id;
	const allowed = await consume(
		event.platform?.env,
		isHeavyApiPath(pathname) ? 'HEAVY_API_RATE_LIMITER' : 'API_RATE_LIMITER',
		userId ? `user:${userId}` : `ip:${clientKey(event.request)}`
	);
	return allowed ? null : tooManyRequests(API_RATE_LIMIT_MESSAGE);
}

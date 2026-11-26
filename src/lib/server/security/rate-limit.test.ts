import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	API_RATE_LIMIT_MESSAGE,
	CREDENTIAL_RATE_LIMIT_MESSAGE,
	EMAIL_RATE_LIMIT_MESSAGE,
	clientKey,
	isCredentialAttemptAllowed,
	isCredentialAuthRequest,
	isEmailAuthRequest,
	isEmailRequestAllowed,
	limitRequest,
	type RateLimitEnv
} from './rate-limit';

/** A binding that allows `limit` calls per key, like Workers Rate Limiting within one period. */
function fakeLimiter(limit: number) {
	const counts = new Map<string, number>();
	return {
		keys: () => [...counts.keys()],
		limit: vi.fn(async ({ key }: { key: string }) => {
			const count = (counts.get(key) ?? 0) + 1;
			counts.set(key, count);
			return { success: count <= limit };
		})
	};
}

function fakeEnv() {
	return {
		AUTH_EMAIL_RATE_LIMITER: fakeLimiter(5),
		AUTH_IP_RATE_LIMITER: fakeLimiter(20),
		API_RATE_LIMITER: fakeLimiter(120),
		HEAVY_API_RATE_LIMITER: fakeLimiter(3)
	};
}

function request(
	path: string,
	{
		ip = '203.0.113.7',
		method = 'GET',
		json
	}: { ip?: string; method?: string; json?: unknown } = {}
) {
	const url = new URL(path, 'https://buku.test');
	const headers = new Headers({ 'CF-Connecting-IP': ip });
	if (json !== undefined) headers.set('Content-Type', 'application/json');
	return {
		url,
		request: new Request(url, {
			method,
			headers,
			body: json === undefined ? undefined : JSON.stringify(json)
		})
	};
}

function event(
	env: RateLimitEnv | undefined,
	path: string,
	options: Parameters<typeof request>[1] & { user?: { id: string; email: string } } = {}
) {
	return { ...request(path, options), locals: { user: options.user }, platform: { env } };
}

async function repeat<T>(times: number, attempt: () => Promise<T>): Promise<T[]> {
	const results: T[] = [];
	for (let i = 0; i < times; i++) results.push(await attempt());
	return results;
}

afterEach(() => vi.restoreAllMocks());

describe('credential attempts', () => {
	it('allows five attempts per account per minute and blocks the sixth', async () => {
		const env = fakeEnv();
		const results = await repeat(6, () =>
			isCredentialAttemptAllowed({ ...request('/masuk'), platform: { env } }, 'ayu@example.com')
		);
		expect(results).toEqual([true, true, true, true, true, false]);
	});

	it('counts the account by normalized email so case and spaces do not reset it', async () => {
		const env = fakeEnv();
		for (const email of ['Ayu@Example.com', ' ayu@example.com ', 'AYU@EXAMPLE.COM']) {
			await isCredentialAttemptAllowed({ ...request('/masuk'), platform: { env } }, email);
		}
		expect(env.AUTH_EMAIL_RATE_LIMITER.keys()).toEqual(['ayu@example.com']);
	});

	it('limits one IP across many accounts more loosely than one account', async () => {
		const env = fakeEnv();
		const results = await repeat(21, async () =>
			isCredentialAttemptAllowed(
				{ ...request('/masuk'), platform: { env } },
				`user${Math.random()}@example.com`
			)
		);
		expect(results.filter(Boolean)).toHaveLength(20);
		expect(results.at(-1)).toBe(false);
	});

	it('still limits by IP when the request carries no email', async () => {
		const env = fakeEnv();
		await isCredentialAttemptAllowed({ ...request('/masuk'), platform: { env } }, null);
		expect(env.AUTH_IP_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
		expect(env.AUTH_EMAIL_RATE_LIMITER.limit).not.toHaveBeenCalled();
	});
});

describe('email requests', () => {
	it('allows five emails per address per minute on counters separate from sign-in', async () => {
		const env = fakeEnv();
		const signIn = () =>
			isCredentialAttemptAllowed({ ...request('/masuk'), platform: { env } }, 'ayu@example.com');
		const reset = () =>
			isEmailRequestAllowed(
				{ ...request('/lupa-kata-sandi'), platform: { env } },
				'Ayu@Example.com'
			);

		expect(await repeat(6, signIn)).toEqual([true, true, true, true, true, false]);
		expect(await repeat(6, reset)).toEqual([true, true, true, true, true, false]);
		expect(env.AUTH_EMAIL_RATE_LIMITER.keys()).toEqual(['ayu@example.com', 'mail:ayu@example.com']);
		expect(env.AUTH_IP_RATE_LIMITER.keys()).toEqual(['203.0.113.7', 'mail:203.0.113.7']);
	});

	it('limits one IP asking for links to many addresses', async () => {
		const env = fakeEnv();
		const results = await repeat(21, () =>
			isEmailRequestAllowed(
				{ ...request('/lupa-kata-sandi'), platform: { env } },
				`user${Math.random()}@example.com`
			)
		);
		expect(results.filter(Boolean)).toHaveLength(20);
		expect(results.at(-1)).toBe(false);
	});

	it("limits better-auth's reset request endpoint by the email in its body", async () => {
		const env = fakeEnv();
		const results = await repeat(6, () =>
			limitRequest(
				event(env, '/api/auth/request-password-reset', {
					method: 'POST',
					json: { email: 'ayu@example.com' }
				})
			)
		);

		const blocked = results[5] as Response;
		expect(results.slice(0, 5)).toEqual([null, null, null, null, null]);
		expect(blocked.status).toBe(429);
		expect(await blocked.json()).toMatchObject({ error: EMAIL_RATE_LIMIT_MESSAGE });
		expect(env.AUTH_EMAIL_RATE_LIMITER.keys()).toEqual(['mail:ayu@example.com']);
		expect(env.API_RATE_LIMITER.limit).not.toHaveBeenCalled();
	});
});

describe('client key', () => {
	it('uses the IPv4 address as is', () => {
		expect(clientKey(request('/', { ip: '198.51.100.4' }).request)).toBe('198.51.100.4');
	});

	it('groups an IPv6 client by its /64 so address rotation does not escape the limit', () => {
		const a = clientKey(request('/', { ip: '2001:db8:0a:1::1' }).request);
		const b = clientKey(request('/', { ip: '2001:0DB8:000A:0001:dead:beef:0:7' }).request);
		expect(a).toBe('2001:db8:a:1::/64');
		expect(b).toBe(a);
		expect(clientKey(request('/', { ip: '::1' }).request)).toBe('0:0:0:0::/64');
	});
});

describe('request limits', () => {
	it('recognizes better-auth credential endpoints but not session reads or sign-out', () => {
		expect(isCredentialAuthRequest('POST', '/api/auth/sign-in/email')).toBe(true);
		expect(isCredentialAuthRequest('POST', '/api/auth/sign-up/email')).toBe(true);
		expect(isCredentialAuthRequest('POST', '/api/auth/reset-password')).toBe(true);
		expect(isCredentialAuthRequest('POST', '/api/auth/request-password-reset')).toBe(false);
		expect(isEmailAuthRequest('POST', '/api/auth/request-password-reset')).toBe(true);
		expect(isEmailAuthRequest('GET', '/api/auth/request-password-reset')).toBe(false);
		expect(isCredentialAuthRequest('POST', '/api/auth/sign-out')).toBe(false);
		expect(isCredentialAuthRequest('GET', '/api/auth/get-session')).toBe(false);
		expect(isCredentialAuthRequest('GET', '/api/auth/reset-password/token')).toBe(false);
	});

	it('limits better-auth sign-in by the email in the JSON body and answers 429', async () => {
		const env = fakeEnv();
		const attempt = () =>
			limitRequest(
				event(env, '/api/auth/sign-in/email', {
					method: 'POST',
					json: { email: 'Ayu@example.com', password: 'salah' }
				})
			);
		const results = await repeat(6, attempt);
		expect(results.slice(0, 5)).toEqual([null, null, null, null, null]);

		const blocked = results[5] as Response;
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get('Retry-After')).toBe('60');
		expect(await blocked.json()).toEqual({
			error: CREDENTIAL_RATE_LIMIT_MESSAGE,
			message: CREDENTIAL_RATE_LIMIT_MESSAGE
		});
		expect(env.AUTH_EMAIL_RATE_LIMITER.keys()).toEqual(['ayu@example.com']);
	});

	it("limits change-password against the signed-in user's account", async () => {
		const env = fakeEnv();
		await limitRequest(
			event(env, '/api/auth/change-password', {
				method: 'POST',
				json: { currentPassword: 'x', newPassword: 'y' },
				user: { id: 'u1', email: 'ayu@example.com' }
			})
		);
		expect(env.AUTH_EMAIL_RATE_LIMITER.keys()).toEqual(['ayu@example.com']);
		expect(env.API_RATE_LIMITER.limit).not.toHaveBeenCalled();
	});

	it('limits other API requests per signed-in user, falling back to the client IP', async () => {
		const env = fakeEnv();
		const user = { id: 'u1', email: 'ayu@example.com' };
		await limitRequest(event(env, '/api/transactions', { user }));
		await limitRequest(event(env, '/api/auth/get-session'));
		expect(env.API_RATE_LIMITER.keys()).toEqual(['user:u1', 'ip:203.0.113.7']);

		const results = await repeat(120, () => limitRequest(event(env, '/api/dashboard', { user })));
		expect(results.filter((r) => r !== null)).toHaveLength(1);
		const blocked = results.find((r) => r !== null) as Response;
		expect(blocked.status).toBe(429);
		expect(await blocked.json()).toMatchObject({ error: API_RATE_LIMIT_MESSAGE });
	});

	it('keeps backup and restore to a few requests per minute', async () => {
		const env = fakeEnv();
		const user = { id: 'u1', email: 'ayu@example.com' };
		const results = await repeat(4, () =>
			limitRequest(event(env, '/api/backup', { method: 'POST', user }))
		);
		expect(results.map((r) => r?.status ?? null)).toEqual([null, null, null, 429]);
		await limitRequest(event(env, '/api/restore', { method: 'POST', user }));
		expect(env.API_RATE_LIMITER.limit).not.toHaveBeenCalled();
	});

	it('does not limit pages; their form actions limit themselves', async () => {
		const env = fakeEnv();
		expect(await limitRequest(event(env, '/masuk?/signInEmail', { method: 'POST' }))).toBeNull();
		expect(await limitRequest(event(env, '/beranda'))).toBeNull();
		expect(Object.values(env).every((binding) => binding.limit.mock.calls.length === 0)).toBe(true);
	});
});

describe('missing or failing bindings', () => {
	it('allows the request and logs each missing binding only once', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (let i = 0; i < 3; i++) {
			expect(await limitRequest(event({}, '/api/dashboard'))).toBeNull();
			expect(await limitRequest(event(undefined, '/api/backup'))).toBeNull();
		}
		const messages = warn.mock.calls.map(([message]) => String(message));
		expect(messages.filter((m) => m.includes('binding API_RATE_LIMITER '))).toHaveLength(1);
		expect(messages.filter((m) => m.includes('HEAVY_API_RATE_LIMITER'))).toHaveLength(1);
	});

	it('allows the request when the binding throws instead of failing closed', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const env = {
			AUTH_IP_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('unavailable')) },
			AUTH_EMAIL_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('unavailable')) }
		};
		expect(
			await isCredentialAttemptAllowed({ ...request('/masuk'), platform: { env } }, 'a@b.co')
		).toBe(true);
	});
});

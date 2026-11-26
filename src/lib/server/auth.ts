import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';
import { enforcePasswordPolicy } from '$lib/server/security/password-policy';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '$lib/shared/password';

function createAuth() {
	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(), { provider: 'sqlite' }),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			maxPasswordLength: PASSWORD_MAX_LENGTH
		},
		hooks: { before: enforcePasswordPolicy },
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

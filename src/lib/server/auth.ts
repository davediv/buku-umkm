import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db';

function createAuth() {
	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(), { provider: 'sqlite' }),
		emailAndPassword: { enabled: true },
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

// Lazy initialization singleton for better-auth
let authInstance: ReturnType<typeof betterAuth> | null = null;

export function getAuth() {
	if (!authInstance) {
		authInstance = createAuth();
	}
	return authInstance;
}

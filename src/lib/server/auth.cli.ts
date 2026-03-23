import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
	baseURL: process.env.ORIGIN || 'http://localhost:5173',
	secret: (() => {
		const s = process.env.BETTER_AUTH_SECRET;
		if (!s) throw new Error('BETTER_AUTH_SECRET environment variable is required');
		return s;
	})(),
	database: drizzleAdapter(
		{
			// This will be replaced by the actual database at runtime
			// For schema generation, we just need a placeholder
			driver: 'sqlite'
		},
		{ provider: 'sqlite' }
	),
	emailAndPassword: { enabled: true }
});

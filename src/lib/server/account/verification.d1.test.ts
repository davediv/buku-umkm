import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { user } from '#lib/server/db/schema.ts';
import { createTestD1 } from '#lib/server/testing/d1.ts';
import { markEmailVerifiedAfterReset } from './verification';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('password reset and email verification', () => {
	it('marks the address verified once a reset link has been used', async () => {
		let resetToken = '';
		const auth = betterAuth({
			baseURL: 'http://localhost:8792',
			secret: 'test-secret-0123456789abcdef0123456789',
			database: drizzleAdapter(harness.db, { provider: 'sqlite' }),
			emailAndPassword: {
				enabled: true,
				async sendResetPassword({ token }) {
					resetToken = token;
				},
				onPasswordReset: ({ user: resetUser }) => markEmailVerifiedAfterReset(harness.db, resetUser)
			},
			logger: { disabled: true }
		});
		const email = 'reset-verifies@example.test';
		const { user: created } = await auth.api.signUpEmail({
			body: { email, password: 'Rahasia123', name: 'Pemilik' }
		});
		expect(created.emailVerified).toBe(false);

		await auth.api.requestPasswordReset({ body: { email } });
		await auth.api.resetPassword({ body: { token: resetToken, newPassword: 'RahasiaBaru456' } });

		const [row] = await harness.db.select().from(user).where(eq(user.id, created.id));
		expect(row.emailVerified).toBe(true);
	});
});

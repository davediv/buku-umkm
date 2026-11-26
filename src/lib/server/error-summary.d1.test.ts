import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm';
import { businessProfile, onboardingState } from '$lib/server/db/schema';
import { createTestD1 } from '$lib/server/testing/d1';
import { summarizeError } from './error-summary';

let harness: Awaited<ReturnType<typeof createTestD1>>;

beforeAll(async () => {
	harness = await createTestD1();
}, 60_000);

afterAll(async () => {
	await harness?.dispose();
});

describe('summarizeError', () => {
	it('keeps the bound parameters of a real failed D1 query out of the summary', async () => {
		const userId = await harness.createUser();
		const profile = {
			id: 'profile-1',
			userId,
			name: 'Warung Rahasia Bu Sri',
			ownerName: 'Sri Wahyuni',
			businessType: 'warung_makan'
		};
		await harness.db.insert(businessProfile).values(profile);

		const failure = await harness.db
			.insert(businessProfile)
			.values(profile)
			.then(
				() => null,
				(error: unknown) => error
			);

		// The raw error is what console.error(error) used to print.
		expect(failure).toBeInstanceOf(DrizzleQueryError);
		expect(String(failure)).toContain('Sri Wahyuni');
		const summary = summarizeError(failure);
		expect(summary).not.toContain('Sri Wahyuni');
		expect(summary).not.toContain('Warung Rahasia');
		expect(summary).not.toContain(userId);
		expect(summary).toMatch(/^DrizzleQueryError: Failed query \(cause: .*UNIQUE constraint failed/);
	});

	it('keeps a D1 batch error, which carries no parameters', async () => {
		const userId = await harness.createUser();
		await harness.db.insert(onboardingState).values({ userId, status: 'skipped' });

		const failure = await harness.db
			.batch([harness.db.insert(onboardingState).values({ userId, status: 'completed' })])
			.then(
				() => null,
				(error: unknown) => error
			);

		expect(summarizeError(failure)).toMatch(
			/^Error: D1_ERROR: UNIQUE constraint failed: onboarding_state\.user_id/
		);
	});

	it('drops the SQL and params of a Drizzle query error and keeps its cause', () => {
		const error = new DrizzleQueryError(
			'insert into "business_profile" ("name", "owner_name") values (?, ?)',
			['Warung Rahasia', 'Ayu'],
			new Error('D1_ERROR: UNIQUE constraint failed: business_profile.user_id: SQLITE_CONSTRAINT')
		);

		expect(summarizeError(error)).toBe(
			'DrizzleQueryError: Failed query (cause: Error: D1_ERROR: UNIQUE constraint failed: business_profile.user_id: SQLITE_CONSTRAINT)'
		);
	});

	it('masks quoted values, keeps only the first line and caps the length', () => {
		expect(
			summarizeError(new TypeError("D1_TYPE_ERROR: Type 'object' not supported for value 'Ayu'"))
		).toBe("TypeError: D1_TYPE_ERROR: Type '…' not supported for value '…'");
		expect(summarizeError(new Error('first line\nsecond line with Ayu'))).toBe('Error: first line');
		expect(summarizeError(new Error('x'.repeat(1_000))).length).toBeLessThan(220);
	});

	it('describes non-Error throws without printing them', () => {
		expect(summarizeError('Warung Rahasia')).toBe('non-Error value thrown (string)');
		expect(summarizeError({ name: 'Ayu' })).toBe('non-Error value thrown (object)');
	});
});

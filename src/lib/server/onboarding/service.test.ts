import { describe, expect, it, vi } from 'vitest';
import type { SQLiteDb } from '$lib/server/db';
import {
	completeOnboarding,
	getOnboardingStatus,
	parseOnboardingForm,
	skipOnboarding
} from './service';

function validFormData(): FormData {
	const formData = new FormData();
	formData.set('businessName', 'Warung Bahagia');
	formData.set('ownerName', 'Ayu');
	formData.set('businessType', 'warung_makan');
	formData.set('accountName', 'Kas Utama');
	formData.set('accountType', 'kas');
	formData.set('openingBalance', '1500000');
	formData.set('openingDate', '2026-01-01');
	return formData;
}

function createDbMock(options?: {
	states?: ({ status: string } | undefined)[];
	profiles?: ({ id: string } | undefined)[];
}) {
	const onboardingFind = vi.fn();
	for (const state of options?.states ?? []) onboardingFind.mockResolvedValueOnce(state);
	const profileFind = vi.fn();
	for (const profile of options?.profiles ?? []) profileFind.mockResolvedValueOnce(profile);
	const insertedValues: unknown[] = [];
	const insert = vi.fn(() => ({
		values: vi.fn((values: unknown) => {
			insertedValues.push(values);
			return { values };
		})
	}));
	const batch = vi.fn().mockResolvedValue([]);
	const db = {
		query: {
			onboardingState: { findFirst: onboardingFind },
			businessProfile: { findFirst: profileFind }
		},
		insert,
		batch
	} as unknown as SQLiteDb;

	return { db, onboardingFind, profileFind, insert, insertedValues, batch };
}

describe('parseOnboardingForm', () => {
	it('accepts and normalizes a valid server payload', () => {
		const formData = validFormData();
		formData.set('businessName', '  Warung Bahagia  ');

		expect(parseOnboardingForm(formData)).toEqual({
			success: true,
			data: {
				businessName: 'Warung Bahagia',
				ownerName: 'Ayu',
				businessType: 'warung_makan',
				accountName: 'Kas Utama',
				accountType: 'kas',
				openingBalance: 1_500_000,
				openingDate: '2026-01-01'
			}
		});
	});

	it('rejects malformed or unsafe financial values', () => {
		const formData = validFormData();
		formData.set('businessType', 'invalid');
		formData.set('openingBalance', '10.5');
		formData.set('openingDate', '9999-01-01');

		const result = parseOnboardingForm(formData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors).toMatchObject({
				businessType: expect.any(String),
				openingBalance: expect.any(String),
				openingDate: expect.any(String)
			});
		}
	});
});

describe('onboarding provisioning', () => {
	it('writes all canonical setup records in one batch and makes retries a no-op', async () => {
		const mock = createDbMock({
			states: [undefined, { status: 'completed' }],
			profiles: [undefined]
		});
		const parsed = parseOnboardingForm(validFormData());
		if (!parsed.success) throw new Error('Expected valid test input');

		const first = await completeOnboarding(mock.db, 'user-1', parsed.data);
		const insertCountAfterFirstRequest = mock.insert.mock.calls.length;
		const second = await completeOnboarding(mock.db, 'user-1', parsed.data);

		expect(first).toEqual({ status: 'completed', created: true });
		expect(second).toEqual({ status: 'completed', created: false });
		expect(mock.batch).toHaveBeenCalledTimes(1);
		expect(mock.batch.mock.calls[0][0]).toHaveLength(5);
		expect(mock.insert).toHaveBeenCalledTimes(insertCountAfterFirstRequest);
	});

	it('persists skip semantics and recognizes pre-migration profiles', async () => {
		const skipMock = createDbMock({ states: [undefined], profiles: [undefined] });
		expect(await skipOnboarding(skipMock.db, 'user-1')).toEqual({
			status: 'skipped',
			created: true
		});
		expect(skipMock.insertedValues[0]).toMatchObject({ userId: 'user-1', status: 'skipped' });

		const legacyMock = createDbMock({ states: [undefined], profiles: [{ id: 'profile-1' }] });
		expect(await getOnboardingStatus(legacyMock.db, 'user-1')).toBe('completed');
	});
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOnboardingStatus } = vi.hoisted(() => ({ getOnboardingStatus: vi.fn() }));
vi.mock('$lib/server/db', () => ({ getDb: () => ({}) }));
vi.mock('$lib/server/onboarding/service', () => ({
	completeOnboarding: vi.fn(),
	getOnboardingStatus,
	parseOnboardingForm: vi.fn(),
	skipOnboarding: vi.fn()
}));

import { load as loadApp } from '../(app)/+layout.server';
import { load as loadOnboarding } from './+page.server';

const authenticatedLocals = {
	user: { id: 'user-1', name: 'Ayu', email: 'ayu@example.com' },
	session: { id: 'session-1' }
};

describe('registration and onboarding route gates', () => {
	beforeEach(() => {
		getOnboardingStatus.mockReset();
	});

	it('keeps a new authenticated user in onboarding and gates the application', async () => {
		getOnboardingStatus.mockResolvedValue(null);

		await expect(
			loadOnboarding({ locals: authenticatedLocals } as Parameters<typeof loadOnboarding>[0])
		).resolves.toEqual({});
		await expect(
			loadApp({ locals: authenticatedLocals } as Parameters<typeof loadApp>[0])
		).rejects.toMatchObject({ status: 302, location: '/onboarding' });
	});

	it('sends completed users to the dashboard and allows application entry', async () => {
		getOnboardingStatus.mockResolvedValue('completed');

		await expect(
			loadOnboarding({ locals: authenticatedLocals } as Parameters<typeof loadOnboarding>[0])
		).rejects.toMatchObject({ status: 302, location: '/beranda' });
		await expect(
			loadApp({ locals: authenticatedLocals } as Parameters<typeof loadApp>[0])
		).resolves.toMatchObject({ onboardingStatus: 'completed' });
	});
});

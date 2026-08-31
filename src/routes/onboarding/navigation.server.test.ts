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

function appLoadEvent(locals: object, url: URL) {
	return {
		locals,
		url,
		untrack: <T>(callback: () => T) => callback()
	} as Parameters<typeof loadApp>[0];
}

describe('registration and onboarding route gates', () => {
	beforeEach(() => {
		getOnboardingStatus.mockReset();
	});

	it('preserves a protected destination when authentication is required', async () => {
		const appUrl = new URL('https://buku.test/laporan/neraca?date=2026-08-30');

		await expect(loadApp(appLoadEvent({}, appUrl))).rejects.toMatchObject({
			status: 302,
			location: '/masuk?return_to=%2Flaporan%2Fneraca%3Fdate%3D2026-08-30'
		});
	});

	it('keeps a new authenticated user in onboarding and gates the application', async () => {
		getOnboardingStatus.mockResolvedValue(null);
		const onboardingUrl = new URL('https://buku.test/onboarding');
		const appUrl = new URL('https://buku.test/transaksi?q=kopi&page=3');

		await expect(
			loadOnboarding({ locals: authenticatedLocals, url: onboardingUrl } as Parameters<
				typeof loadOnboarding
			>[0])
		).resolves.toEqual({ returnTo: '/beranda' });
		await expect(loadApp(appLoadEvent(authenticatedLocals, appUrl))).rejects.toMatchObject({
			status: 302,
			location: '/onboarding?return_to=%2Ftransaksi%3Fq%3Dkopi%26page%3D3'
		});
	});

	it('sends completed users to the dashboard and allows application entry', async () => {
		getOnboardingStatus.mockResolvedValue('completed');
		const onboardingUrl = new URL(
			'https://buku.test/onboarding?return_to=%2Flaporan%2Fneraca%3Fdate%3D2026-08-30'
		);
		const appUrl = new URL('https://buku.test/beranda');

		await expect(
			loadOnboarding({ locals: authenticatedLocals, url: onboardingUrl } as Parameters<
				typeof loadOnboarding
			>[0])
		).rejects.toMatchObject({
			status: 302,
			location: '/laporan/neraca?date=2026-08-30'
		});
		await expect(loadApp(appLoadEvent(authenticatedLocals, appUrl))).resolves.toMatchObject({
			onboardingStatus: 'completed'
		});
	});

	it('reads redirect destinations without tracking ordinary URL changes', async () => {
		getOnboardingStatus.mockResolvedValue('completed');
		const untrack = vi.fn(<T>(callback: () => T) => callback());

		await expect(
			loadApp({
				locals: authenticatedLocals,
				url: new URL('https://buku.test/transaksi?page=2'),
				untrack
			} as unknown as Parameters<typeof loadApp>[0])
		).resolves.toMatchObject({ onboardingStatus: 'completed' });

		expect(untrack).toHaveBeenCalledOnce();
	});
});

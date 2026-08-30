import { describe, expect, it } from 'vitest';
import {
	DEFAULT_APP_RETURN_TO,
	getLoginHref,
	getOnboardingHref,
	getRegistrationHref,
	getSafeAppReturnTo,
	getSafeLoginReturnTo
} from './return-to';

describe('authenticated return navigation', () => {
	it('preserves allow-listed application paths and query state', () => {
		const target = '/transaksi?q=kopi&type=expense&page=3';

		expect(getSafeAppReturnTo(target)).toBe(target);
		expect(getLoginHref(target)).toBe(`/masuk?return_to=${encodeURIComponent(target)}`);
		expect(getRegistrationHref(target)).toBe(`/daftar?return_to=${encodeURIComponent(target)}`);
		expect(getOnboardingHref(target)).toBe(`/onboarding?return_to=${encodeURIComponent(target)}`);
	});

	it('allows login to resume onboarding without broadening application redirects', () => {
		expect(getSafeLoginReturnTo('/onboarding?return_to=%2Flaporan%2Fneraca')).toBe(
			'/onboarding?return_to=%2Flaporan%2Fneraca'
		);
		expect(getSafeAppReturnTo('/onboarding')).toBeNull();
	});

	it('rejects external, protocol-relative, malformed, and unrelated targets', () => {
		for (const target of [
			'https://evil.example/transaksi',
			'//evil.example/transaksi',
			'/\\evil.example',
			'/api/backup',
			'/masuk',
			'/transaksi\nLocation: https://evil.example'
		]) {
			expect(getSafeAppReturnTo(target)).toBeNull();
		}
		expect(getLoginHref('https://evil.example')).toBe('/masuk');
		expect(DEFAULT_APP_RETURN_TO).toBe('/beranda');
	});
});

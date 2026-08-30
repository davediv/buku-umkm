import { describe, expect, it } from 'vitest';
import { secondaryNavigationItems } from './secondary-navigation';

describe('secondary navigation', () => {
	it('contains only unique, actionable internal destinations', () => {
		const hrefs = secondaryNavigationItems.map((item) => item.href);

		expect(hrefs.every((href) => href.startsWith('/'))).toBe(true);
		expect(hrefs.every((href) => href !== '#' && !href.startsWith('/onboarding'))).toBe(true);
		expect(new Set(hrefs).size).toBe(hrefs.length);
	});

	it('exposes all required settings and information destinations', () => {
		const hrefs = secondaryNavigationItems.map((item) => item.href);

		expect(hrefs).toEqual(
			expect.arrayContaining([
				'/pengaturan?bagian=profil',
				'/pajak/profil',
				'/pengaturan?bagian=akun',
				'/pengaturan?bagian=data',
				'/bantuan',
				'/privasi',
				'/tentang'
			])
		);
	});
});

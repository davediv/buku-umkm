import { describe, expect, it } from 'vitest';
import {
	getSettingsHref,
	resolveSettingsSection,
	SETTINGS_SECTION_IDS
} from './settings-navigation';

describe('settings navigation', () => {
	it('gives every section a distinct address', () => {
		const hrefs = SETTINGS_SECTION_IDS.map(getSettingsHref);

		expect(new Set(hrefs).size).toBe(SETTINGS_SECTION_IDS.length);
		expect(hrefs).toEqual([
			'/pengaturan?bagian=profil',
			'/pengaturan?bagian=akun',
			'/pengaturan?bagian=data'
		]);
	});

	it('falls back safely when a section is missing or invalid', () => {
		expect(resolveSettingsSection(null)).toBe('profil');
		expect(resolveSettingsSection('tidak-ada')).toBe('profil');
		expect(resolveSettingsSection('data')).toBe('data');
	});
});

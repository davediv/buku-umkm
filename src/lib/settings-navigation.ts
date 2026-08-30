export const SETTINGS_SECTION_IDS = ['profil', 'akun', 'data'] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export function resolveSettingsSection(value: string | null): SettingsSectionId {
	return SETTINGS_SECTION_IDS.includes(value as SettingsSectionId)
		? (value as SettingsSectionId)
		: 'profil';
}

export function getSettingsHref(section: SettingsSectionId): string {
	return `/pengaturan?bagian=${section}`;
}

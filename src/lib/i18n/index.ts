import { id, type LocaleMessages } from './id';

// Available locales
export const locales = {
	id: 'Bahasa Indonesia'
} as const;

export type Locale = keyof typeof locales;

// Current locale - defaults to Indonesian
let currentLocale: Locale = 'id';

// Get translations for current locale
export function getTranslations(): LocaleMessages {
	// Currently only Indonesian is supported
	// Add more locales by creating locale files and updating this function
	return id;
}

// Set current locale
export function setLocale(locale: Locale): void {
	currentLocale = locale;
}

// Get current locale
export function getLocale(): Locale {
	return currentLocale;
}

/**
 * Translation helper function
 * Usage: t('common.save') or t('auth.login')
 */
export function t(key: string, params?: Record<string, string | number>): string {
	const translations = getTranslations();
	const keys = key.split('.');
	let value: unknown = translations;

	for (const k of keys) {
		if (value && typeof value === 'object' && k in value) {
			value = (value as Record<string, unknown>)[k];
		} else {
			console.warn(`Translation key not found: ${key}`);
			return key;
		}
	}

	if (typeof value !== 'string') {
		console.warn(`Translation key is not a string: ${key}`);
		return key;
	}

	// Replace parameters
	if (params) {
		return Object.entries(params).reduce(
			(str, [paramKey, paramValue]) => str.replace(`{${paramKey}}`, String(paramValue)),
			value
		);
	}

	return value;
}

export { id };
export type { LocaleMessages };

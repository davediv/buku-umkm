const INTERNAL_ORIGIN = 'https://buku-umkm.invalid';
const MAX_RETURN_TO_LENGTH = 2048;

const APP_ROUTE_ROOTS = [
	'/beranda',
	'/transaksi',
	'/akun',
	'/kategori',
	'/hutang-piutang',
	'/laporan',
	'/pajak',
	'/pengaturan',
	'/lainnya',
	'/bantuan',
	'/privasi',
	'/tentang'
] as const;

export const DEFAULT_APP_RETURN_TO = '/beranda';

function hasControlCharacters(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 31 || code === 127) return true;
	}
	return false;
}

function parseInternalPath(value: string | null | undefined): URL | null {
	if (
		!value ||
		value.length > MAX_RETURN_TO_LENGTH ||
		!value.startsWith('/') ||
		value.startsWith('//') ||
		value.includes('\\') ||
		hasControlCharacters(value)
	) {
		return null;
	}

	try {
		const parsed = new URL(value, INTERNAL_ORIGIN);
		return parsed.origin === INTERNAL_ORIGIN ? parsed : null;
	} catch {
		return null;
	}
}

function isAppPath(pathname: string): boolean {
	return APP_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function serialize(parsed: URL): string {
	return `${parsed.pathname}${parsed.search}`;
}

export function getSafeAppReturnTo(value: string | null | undefined): string | null {
	const parsed = parseInternalPath(value);
	return parsed && isAppPath(parsed.pathname) ? serialize(parsed) : null;
}

export function getSafeLoginReturnTo(value: string | null | undefined): string | null {
	const parsed = parseInternalPath(value);
	if (!parsed) return null;
	if (isAppPath(parsed.pathname) || parsed.pathname === '/onboarding') return serialize(parsed);
	return null;
}

function withReturnTo(
	pathname: '/masuk' | '/daftar' | '/onboarding',
	returnTo: string | null
): string {
	if (!returnTo) return pathname;
	return `${pathname}?${new URLSearchParams({ return_to: returnTo }).toString()}`;
}

export function getLoginHref(returnTo: string | null | undefined): string {
	return withReturnTo('/masuk', getSafeLoginReturnTo(returnTo));
}

export function getRegistrationHref(returnTo: string | null | undefined): string {
	return withReturnTo('/daftar', getSafeAppReturnTo(returnTo));
}

export function getOnboardingHref(returnTo: string | null | undefined): string {
	return withReturnTo('/onboarding', getSafeAppReturnTo(returnTo));
}

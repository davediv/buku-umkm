const NAVIGATION_ORIGIN_KEY = 'buku-umkm:navigation-origin';

type NavigationStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface RememberedNavigation {
	destination: string;
	origin: string;
}

export function rememberNavigationOrigin(
	destination: string,
	origin: string,
	storage: NavigationStorage = sessionStorage
) {
	storage.setItem(NAVIGATION_ORIGIN_KEY, JSON.stringify({ destination, origin }));
}

export function getRememberedNavigationOrigin(
	destination: string,
	storage: NavigationStorage = sessionStorage
): string | null {
	try {
		const stored = storage.getItem(NAVIGATION_ORIGIN_KEY);
		if (!stored) return null;
		const parsed = JSON.parse(stored) as Partial<RememberedNavigation>;
		return parsed.destination === destination && typeof parsed.origin === 'string'
			? parsed.origin
			: null;
	} catch {
		return null;
	}
}

export function shouldUseHistoryBack(
	href: string,
	previousUrl: string,
	currentOrigin: string
): boolean {
	if (!previousUrl) return false;

	try {
		const target = new URL(href, currentOrigin);
		const previous = new URL(previousUrl, currentOrigin);
		return (
			target.origin === currentOrigin &&
			previous.origin === currentOrigin &&
			`${previous.pathname}${previous.search}` === `${target.pathname}${target.search}`
		);
	} catch {
		return false;
	}
}

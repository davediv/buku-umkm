import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

const CACHE_NAME = `buku-umkm-cache-${version}`;
const CACHE_PREFIX = 'buku-umkm-cache-';
// Manifest paths are relative to the base path, which is this service worker's scope.
const toPathname = (path: string) => new URL(path, self.registration.scope).pathname;
const BUILD_ASSETS = immutable.map(({ path }) => toPathname(path));
// Cloudflare's asset server intentionally does not expose dotfiles such as
// static/.assetsignore. Including one in addAll() rejects the whole install.
const PUBLIC_ASSETS = assets
	.map(({ path }) => toPathname(path))
	.filter((asset) => {
		const filename = asset.split('/').pop();
		return filename ? !filename.startsWith('.') : false;
	});
const OFFLINE_ASSET = PUBLIC_ASSETS.find((asset) => asset.endsWith('offline.html'));
// Cloudflare serves HTML assets at extensionless canonical URLs. Caching the
// redirected response makes Chrome reject it when used for another navigation.
const OFFLINE_PAGE = OFFLINE_ASSET?.replace(/\.html$/, '') ?? '/offline';
const PRECACHE_ASSETS = PUBLIC_ASSETS.map((asset) =>
	asset === OFFLINE_ASSET ? OFFLINE_PAGE : asset
);
const CACHEABLE_PATHS = new Set([...BUILD_ASSETS, ...PRECACHE_ASSETS]);

// Keep installation lightweight: route bundles are cached only after the user visits them.
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(PRECACHE_ASSETS);
		})
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys
					.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
					.map((key) => caches.delete(key))
			);
		})
	);
});

// Fetch event - cache only known public assets, never authenticated route data.
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Skip cross-origin requests (e.g., analytics, external fonts)
	if (url.origin !== self.location.origin) return;

	// Skip API requests entirely — never cache authenticated data
	if (url.pathname.startsWith('/api/')) return;

	// For navigation requests (HTML), always use network (pages contain user-specific data)
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const offlinePage = await caches.match(OFFLINE_PAGE);
				return offlinePage ?? Response.error();
			})
		);
		return;
	}

	// Ignore SvelteKit data requests and any other URL not in the generated public asset manifest.
	if (!CACHEABLE_PATHS.has(url.pathname)) return;

	// Versioned build assets are immutable, so a cache hit never needs background revalidation.
	let cacheWrite = Promise.resolve();
	const response = caches.match(event.request).then(async (cached) => {
		if (cached) return cached;

		const networkResponse = await fetch(event.request);
		if (networkResponse.ok) {
			// Clone now: once respondWith() starts reading the body, clone() throws.
			const copy = networkResponse.clone();
			cacheWrite = caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
		}
		return networkResponse;
	});

	event.respondWith(response);
	event.waitUntil(
		response.then(
			() => cacheWrite.catch(() => undefined),
			() => undefined
		)
	);
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

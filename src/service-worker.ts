/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `buku-umkm-cache-${version}`;
const ASSETS = [...build, ...files];

// Install event - cache all static assets
self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS);
		})
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
		})
	);
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: FetchEvent) => {
	const url = new URL(event.request.url);

	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Skip cross-origin requests (e.g., analytics, external fonts)
	if (url.origin !== location.origin) return;

	// Skip API requests entirely — never cache authenticated data
	if (url.pathname.startsWith('/api/')) return;

	// For navigation requests (HTML), always use network (pages contain user-specific data)
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(() => {
				// Offline fallback: serve cached version or root
				return caches.match(event.request).then((cached) => {
					return cached || caches.match('/');
				});
			})
		);
		return;
	}

	// For static assets, try cache first, then network
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) {
				// Return cached version and update in background
				fetch(event.request).then((response) => {
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, response);
					});
				});
				return cached;
			}

			// Not in cache, fetch from network
			return fetch(event.request).then((response) => {
				// Cache successful responses
				if (response.status === 200) {
					const responseClone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseClone);
					});
				}
				return response;
			});
		})
	);
});

// Handle messages from the main thread
self.addEventListener('message', (event: MessageEvent) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		(self as unknown as ServiceWorkerGlobalScope).skipWaiting();
	}
});

export {};

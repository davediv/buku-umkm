<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { initStores, destroyStores } from '$lib/db/stores';

	let { children } = $props();

	onMount(() => {
		// Initialize database stores
		if (browser) {
			initStores();
		}

		// Register service worker
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered:', registration.scope);

					// Check for updates
					registration.addEventListener('updatefound', () => {
						const newWorker = registration.installing;
						if (newWorker) {
							newWorker.addEventListener('statechange', () => {
								if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
									// New version available
									if (confirm('Versi baru tersedia. Muat ulang untuk memperbarui?')) {
										newWorker.postMessage({ type: 'SKIP_WAITING' });
										window.location.reload();
									}
								}
							});
						}
					});
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		}

		// Cleanup on unmount
		return () => {
			destroyStores();
		};
	});
</script>

{@render children()}

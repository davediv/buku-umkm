<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { toast } from '$lib/components/ui/toast';

	let { children } = $props();

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;

		let registration: ServiceWorkerRegistration | null = null;
		let installingWorker: ServiceWorker | null = null;
		const handleStateChange = () => {
			if (installingWorker?.state === 'installed' && navigator.serviceWorker.controller) {
				toast.info('Versi baru tersedia', 'Muat ulang halaman untuk memperbarui.');
				installingWorker.postMessage({ type: 'SKIP_WAITING' });
			}
		};
		const handleUpdateFound = () => {
			installingWorker?.removeEventListener('statechange', handleStateChange);
			installingWorker = registration?.installing ?? null;
			installingWorker?.addEventListener('statechange', handleStateChange);
		};
		const observeRegistration = async () => {
			try {
				registration = await navigator.serviceWorker.ready;
				registration.addEventListener('updatefound', handleUpdateFound);
			} catch (error) {
				console.error('Service Worker registration failed:', error);
			}
		};

		if (document.readyState === 'complete') void observeRegistration();
		else window.addEventListener('load', observeRegistration, { once: true });

		return () => {
			window.removeEventListener('load', observeRegistration);
			registration?.removeEventListener('updatefound', handleUpdateFound);
			installingWorker?.removeEventListener('statechange', handleStateChange);
		};
	});
</script>

{@render children()}

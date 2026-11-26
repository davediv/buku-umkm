import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			platformProxy: {
				configPath: './wrangler.jsonc',
				persist: { path: '.wrangler/state' }
			}
		}),
		// SvelteKit adds a per-response nonce to its inline scripts on server-rendered pages and
		// hashes on prerendered ones, so scripts need no 'unsafe-inline'. The other security
		// headers are set in src/hooks.server.ts.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte style attributes and transitions write inline styles, which nonces cannot cover.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self', 'data:'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'frame-src': ['none'],
				'frame-ancestors': ['none'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};

export default config;

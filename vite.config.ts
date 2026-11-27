import adapter from '@sveltejs/adapter-cloudflare';
import devtoolsJson from 'vite-plugin-devtools-json';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

// Test projects live in vitest.config.ts, which Vitest loads instead of this file.
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				// No `persist` override: the default (.wrangler/state/v3) is the local D1 that
				// `wrangler d1 migrations apply --local` and drizzle.config.ts use.
				platformProxy: { configPath: './wrangler.jsonc' }
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
		}),
		...(process.env.NODE_ENV !== 'production' ? [devtoolsJson()] : [])
	]
});

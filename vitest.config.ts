import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		globals: true,
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					environment: 'node',
					setupFiles: ['src/lib/server/testing/vitest-setup.ts'],
					// *.d1.test.ts files run real batches on a local workerd D1; under a full parallel
					// run (or a slow CI runner) the heaviest take longer than Vitest's 5 s default.
					testTimeout: 30_000
				}
			},
			{
				extends: true,
				test: {
					name: 'browser',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					browser: {
						enabled: true,
						provider: playwright({ launchOptions: { channel: 'chrome' } }),
						instances: [{ browser: 'chromium' }]
					}
				}
			}
		]
	},
	resolve: {
		alias: {
			// Tests run in Node, not workerd; the stub lets them set the Worker's bindings.
			'cloudflare:workers': '/src/lib/server/testing/cloudflare-workers.ts'
		}
	}
});

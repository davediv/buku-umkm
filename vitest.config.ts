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
			$lib: '/src/lib'
		}
	}
});

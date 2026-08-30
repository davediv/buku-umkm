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
					environment: 'node'
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

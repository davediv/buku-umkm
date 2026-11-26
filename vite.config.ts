import devtoolsJson from 'vite-plugin-devtools-json';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

// Test projects live in vitest.config.ts, which Vitest loads instead of this file.
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		...(process.env.NODE_ENV !== 'production' ? [devtoolsJson()] : [])
	]
});

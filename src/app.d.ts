import type { User, Session } from 'better-auth/minimal';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Cloudflare bindings come from `cloudflare:workers` (`env`, `waitUntil`), not `event.platform`.
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
		}
	}
}

export {};

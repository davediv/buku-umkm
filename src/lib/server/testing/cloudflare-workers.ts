/**
 * Stands in for the `cloudflare:workers` module in unit tests: vitest.config.ts aliases the
 * module to this file. Tests give the code under test its bindings with `setBindings`.
 */
export const env: Record<string, unknown> = {};

/** Replaces the Worker's bindings; with no argument, the Worker has none. */
export function setBindings(bindings: Record<string, unknown> = {}): void {
	for (const name of Object.keys(env)) delete env[name];
	Object.assign(env, bindings);
}

/** There is no request lifetime to extend outside workerd; the promise still settles. */
export function waitUntil(): void {}

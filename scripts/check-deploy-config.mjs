#!/usr/bin/env node
// Stops a deploy that would ship placeholder configuration.
//
//   node scripts/check-deploy-config.mjs [--env staging]
//
// The repository is a public template, so wrangler.jsonc keeps placeholders such as
// <YOUR_D1_DATABASE_ID>. Wrangler would happily deploy them and the Worker would then
// fail at runtime; this check fails first with a list of what to fill in.
import { execFileSync } from 'node:child_process';
import { unstable_readConfig } from 'wrangler';

const REQUIRED_SECRETS = ['BETTER_AUTH_SECRET', 'NPWP_ENCRYPTION_KEY'];
const PLACEHOLDER = /<[A-Z0-9_]+>/;

const envFlag = process.argv.indexOf('--env');
const env = envFlag === -1 ? undefined : process.argv[envFlag + 1];
const label = env ? `environment "${env}"` : 'the production (top-level) environment';

const config = unstable_readConfig({ config: 'wrangler.jsonc', env });
const problems = [];

// Every binding and var that still holds a <PLACEHOLDER>.
function findPlaceholders(value, path) {
	if (typeof value === 'string') {
		if (PLACEHOLDER.test(value)) problems.push(`${path} is still "${value}"`);
	} else if (Array.isArray(value)) {
		value.forEach((item, index) => findPlaceholders(item, `${path}[${index}]`));
	} else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) findPlaceholders(item, `${path}.${key}`);
	}
}

for (const key of [
	'name',
	'routes',
	'vars',
	'd1_databases',
	'r2_buckets',
	'kv_namespaces',
	'ratelimits',
	'send_email'
]) {
	findPlaceholders(config[key], key);
}

const origin = config.vars?.ORIGIN;
if (typeof origin !== 'string' || origin === '') {
	problems.push('vars.ORIGIN is not set (the public https:// URL of the app)');
} else if (!PLACEHOLDER.test(origin) && !origin.startsWith('https://')) {
	problems.push(`vars.ORIGIN must be an https:// URL, got "${origin}"`);
}
if (config.send_email?.length && !config.vars?.EMAIL_FROM) {
	problems.push('vars.EMAIL_FROM is not set (the sender address for account emails)');
}

if (problems.length > 0) {
	console.error(`Deploy stopped: wrangler.jsonc is not ready for ${label}.\n`);
	for (const problem of problems) console.error(`  - ${problem}`);
	console.error('\nSee "Deployment" in README.md.');
	process.exit(1);
}

// Secrets live in Cloudflare, not in the repository. Checking them needs a logged-in
// wrangler and an existing Worker, so a failed lookup only warns.
try {
	const args = ['wrangler', 'secret', 'list', '--format', 'json', ...(env ? ['--env', env] : [])];
	const output = execFileSync('pnpm', ['exec', ...args], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
	const names = new Set(JSON.parse(output).map((secret) => secret.name));
	const missing = REQUIRED_SECRETS.filter((name) => !names.has(name));
	if (missing.length > 0) {
		console.error(`Deploy stopped: missing Worker secrets for ${label}: ${missing.join(', ')}`);
		console.error(`Set each with: pnpm wrangler secret put <NAME>${env ? ` --env ${env}` : ''}`);
		process.exit(1);
	}
} catch {
	console.warn(
		`Could not list Worker secrets for ${label}; make sure ${REQUIRED_SECRETS.join(' and ')} are set.`
	);
}

console.log(`wrangler.jsonc looks ready for ${label}.`);

import { defineEnvVars } from '@sveltejs/kit/env';

// Read when the app starts: Worker vars and secrets in production (wrangler.jsonc), .env under
// `pnpm dev`. `(input) => input` lets a value be missing, as with `$env/dynamic/private`; the
// code that needs it reports that (e.g. getEncryptionSecret, sendAccountEmail).
const optional = (input: string | undefined) => input;

export const variables = defineEnvVars({
	ORIGIN: {
		description: 'Public https:// URL of the app. Auth cookies and email links are built from it.',
		schema: optional
	},
	BETTER_AUTH_SECRET: {
		description: 'Better Auth signing secret: at least 32 random characters.',
		schema: optional
	},
	NPWP_ENCRYPTION_KEY: {
		description: 'Encrypts NPWP (tax ID) at rest: at least 32 characters. Keep it stable.',
		schema: optional
	},
	EMAIL_FROM: {
		description: 'Sender of password reset and verification emails.',
		schema: optional
	}
});

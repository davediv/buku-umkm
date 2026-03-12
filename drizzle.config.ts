import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: '.wrangler/state/v3/d1/buku-umkm-db/00000000000000-0000-0000-0000-000000000000.sqlite'
	}
});

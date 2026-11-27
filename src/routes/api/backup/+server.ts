import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import { buildBackupArchive } from '#lib/server/backup/export.ts';
import { todayInJakarta } from '#lib/shared/dates.ts';

// POST /api/backup - Download every row the signed-in user owns, and their receipt images, as a .zip
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const now = new Date();
		const archive = await buildBackupArchive(getDb(), locals.user.id, env.R2 ?? null, now);
		const name = archive.businessName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

		return new Response(archive.stream, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="backup-${name || 'UMKM'}-${todayInJakarta(now)}.zip"`,
				// Financial records: never kept in a shared device's HTTP cache.
				'Cache-Control': 'private, no-store',
				'X-Backup-Schema-Version': archive.schemaVersion,
				'X-Backup-Photo-Images': 'included',
				'X-Backup-Photo-Count': String(archive.photoCount),
				// Photos whose image was no longer in storage: only their metadata is in the file.
				'X-Backup-Photos-Without-Image': String(archive.photosWithoutImage),
				// "all", "data-only" (over what /api/restore takes in one request with the
				// photos; backup.json alone fits) or "none".
				'X-Backup-Restorable': archive.restorable
			}
		});
	} catch (error) {
		console.error('Backup failed', summarizeError(error));
		return json({ error: 'Terjadi kesalahan saat membuat cadangan' }, { status: 500 });
	}
};

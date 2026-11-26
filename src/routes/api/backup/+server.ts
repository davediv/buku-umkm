import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { summarizeError } from '$lib/server/error-summary';
import { backupRowCount, buildBackupDocument } from '$lib/server/backup/export';
import { MAX_BACKUP_BYTES, MAX_RESTORE_ROWS } from '$lib/server/backup/format';
import { todayInJakarta } from '$lib/shared/dates';

// POST /api/backup - Download every row the signed-in user owns as a backup file
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const now = new Date();
		const document = await buildBackupDocument(getDb(), locals.user.id, now);
		const body = new TextEncoder().encode(JSON.stringify(document));
		const restorable =
			body.byteLength <= MAX_BACKUP_BYTES && backupRowCount(document) <= MAX_RESTORE_ROWS;
		const name = document.businessName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');

		return new Response(body, {
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="backup-${name || 'UMKM'}-${todayInJakarta(now)}.json"`,
				// Financial records: never kept in a shared device's HTTP cache.
				'Cache-Control': 'private, no-store',
				'X-Backup-Schema-Version': document.schemaVersion,
				// Only photo metadata is in the file; the images stay in storage. A restore into
				// the same account reattaches the ones still stored there.
				'X-Backup-Photo-Images': 'not-included',
				'X-Backup-Photo-Count': String(document.photos.length),
				// False when the file is over what /api/restore accepts in one go.
				'X-Backup-Restorable': String(restorable)
			}
		});
	} catch (error) {
		console.error('Backup failed', summarizeError(error));
		return json({ error: 'Terjadi kesalahan saat membuat cadangan' }, { status: 500 });
	}
};

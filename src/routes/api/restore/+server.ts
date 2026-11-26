import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { summarizeError } from '$lib/server/error-summary';
import { MAX_BACKUP_BYTES, MULTIPART_OVERHEAD_BYTES } from '$lib/server/backup/format';
import { BackupError } from '$lib/server/backup/parse';
import { parseMultipart, readBodyWithLimit } from '$lib/server/backup/request-body';
import { restoreBackup } from '$lib/server/backup/restore';

const TOO_LARGE = `Ukuran file backup terlalu besar (maks ${MAX_BACKUP_BYTES / 1024 / 1024} MB)`;

function failure(error: string, status: number, code = 'INVALID_BACKUP') {
	return json({ error, code }, { status });
}

/** The backup file's text from a JSON body or a multipart upload (field `file`), size-capped. */
async function readBackupText(request: Request): Promise<string | Response> {
	const contentType = request.headers.get('content-type') ?? '';
	const multipart = contentType.includes('multipart/form-data');
	if (!multipart && !contentType.includes('application/json')) {
		return failure('Format permintaan tidak didukung: unggah file backup .json', 415);
	}

	const body = await readBodyWithLimit(
		request,
		multipart ? MAX_BACKUP_BYTES + MULTIPART_OVERHEAD_BYTES : MAX_BACKUP_BYTES
	);
	if (!body) return failure(TOO_LARGE, 413, 'BACKUP_TOO_LARGE');
	if (!multipart) return new TextDecoder().decode(body);

	const form = await parseMultipart(body, contentType).catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File)) return failure('File backup tidak ditemukan', 400);
	if (file.size > MAX_BACKUP_BYTES) return failure(TOO_LARGE, 413, 'BACKUP_TOO_LARGE');
	return file.text();
}

// POST /api/restore - Replace the caller's data with the contents of a backup file
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const text = await readBackupText(request);
		if (text instanceof Response) return text;

		let file: unknown;
		try {
			file = JSON.parse(text);
		} catch {
			return failure('File backup bukan JSON yang valid', 400);
		}

		const summary = await restoreBackup(getDb(), locals.user.id, file, {
			receipts: platform?.env?.R2 ?? null
		});
		return json({ success: true, message: 'Data berhasil dipulihkan dari backup', summary });
	} catch (error) {
		if (error instanceof BackupError) return failure(error.message, error.status, error.code);
		console.error('Restore failed', summarizeError(error));
		return json(
			{ error: 'Terjadi kesalahan saat memulihkan data', code: 'INTERNAL_ERROR' },
			{ status: 500 }
		);
	}
};

import { env, waitUntil } from 'cloudflare:workers';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import {
	MAX_BACKUP_ARCHIVE_BYTES,
	MAX_BACKUP_BYTES,
	MULTIPART_OVERHEAD_BYTES
} from '#lib/server/backup/format.ts';
import { BackupError } from '#lib/server/backup/parse.ts';
import {
	declaredContentLength,
	parseMultipart,
	readBodyWithLimit
} from '#lib/server/backup/request-body.ts';
import { restoreBackup, restoreBackupArchive } from '#lib/server/backup/restore.ts';

const TOO_LARGE = `Ukuran file backup terlalu besar (maks ${MAX_BACKUP_BYTES / 1024 / 1024} MB)`;
const ARCHIVE_TOO_LARGE = `Ukuran file backup .zip terlalu besar untuk dipulihkan sekaligus (maks ${MAX_BACKUP_ARCHIVE_BYTES / 1024 / 1024} MB)`;
/** What browsers send for a .zip file (Windows reports the second). */
const ZIP_CONTENT_TYPES = ['application/zip', 'application/x-zip-compressed'];
const RESTORED = 'Data berhasil dipulihkan dari backup';

function failure(error: string, status: number, code = 'INVALID_BACKUP') {
	return Response.json({ error, code }, { status });
}

/** The backup file's text from a JSON body or a multipart upload (field `file`), size-capped. */
async function readBackupText(request: Request): Promise<string | Response> {
	const contentType = request.headers.get('content-type') ?? '';
	const multipart = contentType.includes('multipart/form-data');
	if (!multipart && !contentType.includes('application/json')) {
		return failure('Format permintaan tidak didukung: unggah file backup .zip atau .json', 415);
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
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || !locals.session) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
		if (ZIP_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
			// The archive streams in as it is read, so its size is refused up front when declared.
			const declared = declaredContentLength(request);
			if (declared !== null && declared > MAX_BACKUP_ARCHIVE_BYTES) {
				return failure(ARCHIVE_TOO_LARGE, 413, 'BACKUP_TOO_LARGE');
			}
			if (!request.body) return failure('File backup kosong', 400);
			const summary = await restoreBackupArchive(getDb(), locals.user.id, request.body, {
				receipts: env.R2 ?? null,
				waitUntil
			});
			return Response.json({ success: true, message: RESTORED, summary });
		}

		const text = await readBackupText(request);
		if (text instanceof Response) return text;

		let file: unknown;
		try {
			file = JSON.parse(text);
		} catch {
			return failure('File backup bukan JSON yang valid', 400);
		}

		const summary = await restoreBackup(getDb(), locals.user.id, file, {
			receipts: env.R2 ?? null
		});
		return Response.json({ success: true, message: RESTORED, summary });
	} catch (error) {
		if (error instanceof BackupError) return failure(error.message, error.status, error.code);
		console.error('Restore failed', summarizeError(error));
		return Response.json(
			{ error: 'Terjadi kesalahan saat memulihkan data', code: 'INTERNAL_ERROR' },
			{ status: 500 }
		);
	}
};

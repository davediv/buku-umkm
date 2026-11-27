import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { batchGuard, isGuardFailure, runBatch } from '#lib/server/db/batch.ts';
import { transactionQueries, transactionPhotoQueries } from '#lib/server/db/queries/index.ts';
import { transaction, transactionPhoto } from '#lib/server/db/schema.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import {
	declaredContentLength,
	parseMultipart,
	readBodyWithLimit
} from '#lib/server/backup/request-body.ts';
import {
	imageExtension,
	MAX_PHOTOS_PER_TRANSACTION,
	MAX_RECEIPT_BYTES,
	receiptKey,
	receiptUrl,
	sanitizePhotoFileName
} from '#lib/server/photos/receipts.ts';

/** The file plus the multipart boundary and part headers around it. */
const MAX_UPLOAD_BYTES = MAX_RECEIPT_BYTES + 16 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

const tooLarge = () =>
	json({ error: `Ukuran file maksimal adalah ${MAX_RECEIPT_BYTES / 1024}KB` }, { status: 413 });
const tooMany = () =>
	json({ error: `Maksimal ${MAX_PHOTOS_PER_TRANSACTION} foto per transaksi` }, { status: 400 });

// GET /api/transactions/[id]/photos - Get all photos for a transaction
export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const transactionId = params.id;

	if (!transactionId) {
		return json({ error: 'ID transaksi diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		// Verify transaction belongs to user
		const txn = await transactionQueries.findById(db, userId, transactionId, true);

		if (!txn) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		// Get photos
		const photos = await transactionPhotoQueries.findByTransactionId(db, userId, transactionId);

		return json({
			photos: photos.map((photo) => ({
				id: photo.id,
				fileName: photo.fileName,
				fileSize: photo.fileSize,
				mimeType: photo.mimeType,
				r2Url: photo.r2Url,
				caption: photo.caption,
				createdAt: photo.createdAt
			}))
		});
	} catch {
		console.error('Error fetching transaction photos');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

// POST /api/transactions/[id]/photos - Upload a new photo
export const POST: RequestHandler = async ({ params, request, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const transactionId = params.id;

	if (!transactionId) {
		return json({ error: 'ID transaksi diperlukan' }, { status: 400 });
	}

	// Before any other work: an oversized upload is refused without reading it.
	const declared = declaredContentLength(request);
	if (declared !== null && declared > MAX_UPLOAD_BYTES) return tooLarge();

	const db = getDb();

	try {
		// Verify transaction belongs to user
		const txn = await transactionQueries.findById(db, userId, transactionId, true);

		if (!txn) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		// Saves uploading a file that cannot be kept; the batch guard below is what
		// enforces the limit when uploads race.
		const photoCount = await transactionPhotoQueries.countByTransactionId(
			db,
			userId,
			transactionId
		);
		if (photoCount >= MAX_PHOTOS_PER_TRANSACTION) return tooMany();

		// Counted as it streams in, so a body without (or with a false) Content-Length is
		// never buffered past the limit the way request.formData() would.
		const body = await readBodyWithLimit(request, MAX_UPLOAD_BYTES);
		if (!body) return tooLarge();
		const contentType = request.headers.get('content-type') ?? '';
		const form = contentType.includes('multipart/form-data')
			? await parseMultipart(body, contentType).catch(() => null)
			: null;
		const file = form?.get('file');

		if (!(file instanceof File)) {
			return json({ error: 'File foto diperlukan' }, { status: 400 });
		}

		// Validate file type
		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return json({ error: 'Format file harus JPEG atau PNG' }, { status: 400 });
		}

		if (file.size > MAX_RECEIPT_BYTES) return tooLarge();

		// Verify actual file content is an image; its bytes, not the claim, set the type.
		const bytes = new Uint8Array(await file.arrayBuffer());
		const extension = imageExtension(bytes);
		if (!extension) {
			return json({ error: 'File bukan gambar JPEG atau PNG yang valid' }, { status: 400 });
		}

		const r2 = env.R2;
		if (!r2) {
			console.error('R2 bucket not configured');
			return json({ error: 'Konfigurasi penyimpanan tidak tersedia' }, { status: 500 });
		}

		const photoId = crypto.randomUUID();
		const r2Key = receiptKey(userId, transactionId, photoId, extension);
		const photo = {
			id: photoId,
			userId,
			transactionId,
			fileName: sanitizePhotoFileName(file.name, `foto.${extension}`),
			fileSize: bytes.byteLength,
			mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
			r2Key,
			r2Url: receiptUrl(r2Key),
			caption: null,
			createdAt: new Date()
		};

		await r2.put(r2Key, bytes, { httpMetadata: { contentType: photo.mimeType } });

		try {
			await runBatch(db, [
				// Checked inside the batch that inserts, so parallel uploads cannot all pass a
				// count taken before any of them was saved.
				batchGuard(
					db,
					sql`exists (select 1 from ${transaction} where ${and(
						eq(transaction.userId, userId),
						eq(transaction.id, transactionId)
					)}) and (select count(*) from ${transactionPhoto} where ${and(
						eq(transactionPhoto.userId, userId),
						eq(transactionPhoto.transactionId, transactionId)
					)}) < ${MAX_PHOTOS_PER_TRANSACTION}`
				),
				db.insert(transactionPhoto).values(photo)
			]);
		} catch (error) {
			// The image is useless without its row.
			await r2.delete(r2Key).catch((cleanupError: unknown) => {
				console.error(
					'Orphaned receipt object after a failed insert',
					summarizeError(cleanupError)
				);
			});
			if (!isGuardFailure(error)) throw error;
			const stillThere = await transactionQueries.findById(db, userId, transactionId, true);
			return stillThere ? tooMany() : json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		return json(
			{
				message: 'Foto berhasil diunggah',
				photo: {
					id: photo.id,
					fileName: photo.fileName,
					fileSize: photo.fileSize,
					mimeType: photo.mimeType,
					r2Url: photo.r2Url,
					createdAt: photo.createdAt
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error uploading transaction photo', summarizeError(error));
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transactionQueries, transactionPhotoQueries } from '$lib/server/db/queries';
import { getRequestEvent } from '$app/server';

const MAX_PHOTOS_PER_TRANSACTION = 3;
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

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

	const db = getDb();

	try {
		// Verify transaction belongs to user
		const txn = await transactionQueries.findById(db, userId, transactionId, true);

		if (!txn) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		// Check max photos limit
		const photoCount = await transactionPhotoQueries.countByTransactionId(
			db,
			userId,
			transactionId
		);

		if (photoCount >= MAX_PHOTOS_PER_TRANSACTION) {
			return json(
				{ error: `Maksimal ${MAX_PHOTOS_PER_TRANSACTION} foto per transaksi` },
				{ status: 400 }
			);
		}

		// Get the multipart form data
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file) {
			return json({ error: 'File foto diperlukan' }, { status: 400 });
		}

		// Validate file type
		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return json({ error: 'Format file harus JPEG atau PNG' }, { status: 400 });
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			return json(
				{ error: `Ukuran file maksimal adalah ${MAX_FILE_SIZE / 1024}KB` },
				{ status: 400 }
			);
		}

		// Get R2 bucket
		const event = getRequestEvent();
		const r2 = event?.platform?.env?.R2;

		if (!r2) {
			console.error('R2 bucket not configured');
			return json({ error: 'Konfigurasi penyimpanan tidak tersedia' }, { status: 500 });
		}

		// Generate unique key for R2
		const photoId = crypto.randomUUID();
		const extension = file.type === 'image/png' ? 'png' : 'jpg';
		const r2Key = `receipts/${userId}/${transactionId}/${photoId}.${extension}`;

		// Convert file to ArrayBuffer and validate magic bytes
		const arrayBuffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		// Verify actual file content matches claimed type
		const isJPEG = uint8Array[0] === 0xff && uint8Array[1] === 0xd8 && uint8Array[2] === 0xff;
		const isPNG =
			uint8Array[0] === 0x89 &&
			uint8Array[1] === 0x50 &&
			uint8Array[2] === 0x4e &&
			uint8Array[3] === 0x47;

		if (!isJPEG && !isPNG) {
			return json({ error: 'File bukan gambar JPEG atau PNG yang valid' }, { status: 400 });
		}

		// Upload to R2
		await r2.put(r2Key, uint8Array, {
			httpMetadata: {
				contentType: file.type
			}
		});

		// Generate public URL (assuming R2 public URL is configured)
		// In production, you'd use R2's public URL or a custom domain
		const r2Url = `/api/photos/${r2Key}`;

		// Save to database
		const photo = await transactionPhotoQueries.create(db, {
			userId,
			transactionId,
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.type,
			r2Key,
			r2Url
		});

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
	} catch {
		console.error('Error uploading transaction photo');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

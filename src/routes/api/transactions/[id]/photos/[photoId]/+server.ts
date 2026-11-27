import { env } from 'cloudflare:workers';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db/index.ts';
import { transactionPhotoQueries } from '#lib/server/db/queries/index.ts';
import { summarizeError } from '#lib/server/error-summary.ts';
import { isOwnReceiptKey } from '#lib/server/photos/receipts.ts';

// DELETE /api/transactions/[id]/photos/[photoId] - Delete a photo
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const transactionId = params.id;
	const photoId = params.photoId;

	if (!transactionId) {
		return json({ error: 'ID transaksi diperlukan' }, { status: 400 });
	}

	if (!photoId) {
		return json({ error: 'ID foto diperlukan' }, { status: 400 });
	}

	const db = getDb();

	try {
		// Verify photo belongs to user and transaction
		const photo = await transactionPhotoQueries.findById(db, userId, photoId);

		if (!photo) {
			return json({ error: 'Foto tidak ditemukan' }, { status: 404 });
		}

		// Verify photo belongs to the specified transaction
		if (photo.transactionId !== transactionId) {
			return json({ error: 'Foto tidak terkait dengan transaksi ini' }, { status: 400 });
		}

		// The row first: if the object delete then fails, an unreferenced image is left in
		// storage rather than a photo that no longer loads.
		await transactionPhotoQueries.delete(db, userId, photoId);

		// The stored key is only trusted inside the user's own prefix. A row restored or
		// written before keys were checked could name another user's object, and deleting
		// the row must never delete that.
		if (!isOwnReceiptKey(userId, photo.r2Key)) {
			console.warn('Photo row removed without deleting its object: key outside the owner prefix');
		} else if (env.R2) {
			await env.R2.delete(photo.r2Key);
		}

		return json({
			message: 'Foto berhasil dihapus'
		});
	} catch (error) {
		console.error('Error deleting transaction photo', summarizeError(error));
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

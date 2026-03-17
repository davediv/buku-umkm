import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { transactionPhotoQueries } from '$lib/server/db/queries';
import { getRequestEvent } from '$app/server';

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

		// Get R2 bucket
		const event = getRequestEvent();
		const r2 = event?.platform?.env?.R2;

		if (r2 && photo.r2Key) {
			// Delete from R2
			await r2.delete(photo.r2Key);
		}

		// Delete from database
		await transactionPhotoQueries.delete(db, userId, photoId);

		return json({
			message: 'Foto berhasil dihapus'
		});
	} catch {
		console.error('Error deleting transaction photo:');
		return json({ error: 'Terjadi kesalahan server' }, { status: 500 });
	}
};

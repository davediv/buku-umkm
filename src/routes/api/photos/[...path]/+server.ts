import type { RequestHandler } from './$types';

// GET /api/photos/[...path] - Serve photos from R2
export const GET: RequestHandler = async ({ params, platform }) => {
	const r2 = platform?.env?.R2;

	if (!r2) {
		return new Response('Storage not configured', { status: 500 });
	}

	const key = params.path;

	if (!key) {
		return new Response('Invalid path', { status: 400 });
	}

	try {
		const object = await r2.get(key);

		if (!object) {
			return new Response('Photo not found', { status: 404 });
		}

		// Determine content type based on key extension
		let contentType = 'application/octet-stream';
		if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
			contentType = 'image/jpeg';
		} else if (key.endsWith('.png')) {
			contentType = 'image/png';
		}

		return new Response(object.body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
			}
		});
	} catch (error) {
		console.error('Error fetching photo from R2:', error);
		return new Response('Error fetching photo', { status: 500 });
	}
};

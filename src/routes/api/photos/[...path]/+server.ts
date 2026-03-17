import type { RequestHandler } from './$types';

// GET /api/photos/[...path] - Serve photos from R2
export const GET: RequestHandler = async ({ params, locals, platform }) => {
	// Require authentication
	if (!locals.user || !locals.session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const r2 = platform?.env?.R2;

	if (!r2) {
		return new Response('Storage not configured', { status: 500 });
	}

	const key = params.path;

	if (!key) {
		return new Response('Invalid path', { status: 400 });
	}

	// Validate path: must start with receipts/{userId}/ and no traversal
	const expectedPrefix = `receipts/${locals.user.id}/`;
	if (!key.startsWith(expectedPrefix)) {
		return new Response('Forbidden', { status: 403 });
	}

	if (key.includes('..') || key.includes('\0') || key.includes('//')) {
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
				'Cache-Control': 'private, max-age=31536000',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch {
		console.error('Error fetching photo from R2');
		return new Response('Error fetching photo', { status: 500 });
	}
};

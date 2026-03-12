import { getAuth } from '$lib/server/auth';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const auth = getAuth();

	try {
		await auth.api.signOut({
			headers: request.headers
		});

		return json({
			message: 'Logout berhasil'
		});
	} catch (error) {
		console.error('Signout error:', error);
		return json({
			message: 'Logout berhasil'
		});
	}
};

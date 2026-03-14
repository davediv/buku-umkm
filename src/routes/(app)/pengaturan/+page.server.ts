import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/login');
	}

	return {
		user: {
			id: locals.user.id,
			email: locals.user.email
		}
	};
};

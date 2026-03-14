import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { businessProfileQueries } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw redirect(302, '/masuk');
	}

	const db = getDb();
	const userId = locals.user.id;

	// Get business profile
	let profile = null;
	try {
		profile = await businessProfileQueries.findByUserId(db, userId);
	} catch (error) {
		console.error('Error fetching profile:', error);
	}

	return {
		user: {
			email: locals.user.email
		},
		profile: profile
			? {
					id: profile.id,
					name: profile.name,
					businessType: profile.businessType,
					address: profile.address,
					phone: profile.phone,
					npwp: profile.npwp,
					ownerName: profile.ownerName,
					industry: profile.industry
				}
			: null
	};
};
